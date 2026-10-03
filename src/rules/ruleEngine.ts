import { AccountingTransaction, ReviewFinding, ReviewSummary, ReviewReport } from '../normalizer/commonModel';

/**
 * Standard Indian GSTIN Validation Regex
 * 2 digits state code + 10 chars PAN + 1 digit entity number + 'Z' + 1 checksum digit/char
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function runAccountingRules(
  transactions: AccountingTransaction[],
  companyName: string,
  periodFrom: string,
  periodTo: string,
  software: 'TallyPrime' | 'Zoho Books'
): ReviewReport {
  const findings: ReviewFinding[] = [];
  let findingCounter = 1;

  const addFinding = (
    severity: 'Critical' | 'Requires review' | 'Observation',
    issueType: string,
    tx: AccountingTransaction,
    explanation: string,
    reason: string,
    suggestedAction: string
  ) => {
    findings.push({
      id: `FND-${String(findingCounter++).padStart(3, '0')}`,
      severity,
      issueType,
      company: tx.companyName || companyName,
      date: tx.date,
      voucherNumber: tx.voucherNumber,
      party: tx.party,
      amount: tx.amount,
      explanation,
      reason,
      suggestedAction,
      transactionId: tx.id,
    });
  };

  // Filter transactions by period if provided
  const periodFiltered = transactions.filter((t) => {
    if (!periodFrom && !periodTo) return true;
    const tDate = t.date;
    if (periodFrom && tDate < periodFrom) return false;
    if (periodTo && tDate > periodTo) return false;
    return true;
  });

  const txList = periodFiltered.length > 0 ? periodFiltered : transactions;

  // 1. Groupings for cross-transaction checks
  const voucherNumMap = new Map<string, AccountingTransaction[]>();
  const partyAmountsMap = new Map<string, number[]>();
  const partyHistoryMap = new Map<string, AccountingTransaction[]>();
  const datePartyAmountMap = new Map<string, AccountingTransaction[]>();

  txList.forEach((t) => {
    // Voucher number grouping (case insensitive)
    const vKey = t.voucherNumber.trim().toLowerCase();
    if (vKey && vKey !== 'vch-0' && !vKey.startsWith('vch-')) {
      const existing = voucherNumMap.get(vKey) || [];
      existing.push(t);
      voucherNumMap.set(vKey, existing);
    }

    // Party amount history
    const pKey = t.party.trim().toLowerCase();
    if (pKey && pKey !== 'general account' && pKey !== 'unknown party') {
      const amounts = partyAmountsMap.get(pKey) || [];
      amounts.push(t.amount);
      partyAmountsMap.set(pKey, amounts);

      const hist = partyHistoryMap.get(pKey) || [];
      hist.push(t);
      partyHistoryMap.set(pKey, hist);
    }

    // Duplicate detection key (Party + Amount + Month or close date)
    const dpKey = `${pKey}_${t.amount.toFixed(2)}`;
    const dpExisting = datePartyAmountMap.get(dpKey) || [];
    dpExisting.push(t);
    datePartyAmountMap.set(dpKey, dpExisting);
  });

  // Calculate party averages for anomaly detection
  const partyAverageMap = new Map<string, { avg: number; count: number }>();
  partyAmountsMap.forEach((amounts, partyKey) => {
    const total = amounts.reduce((acc, curr) => acc + curr, 0);
    partyAverageMap.set(partyKey, {
      avg: total / amounts.length,
      count: amounts.length,
    });
  });

  // Track already flagged pairs to prevent duplicates in findings
  const flaggedDuplicatePairs = new Set<string>();

  // -------------------------------------------------------------
  // RULE EVALUATION LOOP
  // -------------------------------------------------------------
  for (let i = 0; i < txList.length; i++) {
    const t = txList[i];
    const partyLower = t.party.toLowerCase();
    const ledgerLower = t.ledger.toLowerCase();
    const descLower = (t.description || '').toLowerCase();
    const vchTypeLower = t.voucherType.toLowerCase();

    // 1 & 2. Duplicate Invoice Numbers
    const vKey = t.voucherNumber.trim().toLowerCase();
    const vMatches = voucherNumMap.get(vKey);
    if (vMatches && vMatches.length > 1) {
      const pairKey = `vch_${vKey}`;
      if (!flaggedDuplicatePairs.has(pairKey)) {
        flaggedDuplicatePairs.add(pairKey);
        const otherTx = vMatches.find((m) => m.id !== t.id) || vMatches[1];
        addFinding(
          'Critical',
          'Duplicate Invoice / Voucher Number',
          t,
          `Invoice / Voucher number "${t.voucherNumber}" appears multiple times in the ledger records.`,
          `Voucher number duplicated across entries on ${t.date} (${formatInr(t.amount)}) and ${otherTx.date} (${formatInr(otherTx.amount)}). Duplicate invoice numbers can cause duplicate revenue/expense recognition or GST return rejection.`,
          `Verify original bill/invoice file. Confirm whether this is an accidental double-entry or distinct series with identical numbering.`
        );
      }
    }

    // 3 & 18. Duplicate Transaction / Invoice Amounts (same party, identical amount, near dates)
    const dpKey = `${partyLower}_${t.amount.toFixed(2)}`;
    const dpMatches = datePartyAmountMap.get(dpKey);
    if (dpMatches && dpMatches.length > 1 && t.amount > 0 && partyLower !== 'general account') {
      const pairKey = `dp_${dpKey}`;
      if (!flaggedDuplicatePairs.has(pairKey)) {
        flaggedDuplicatePairs.add(pairKey);
        const duplicateTx = dpMatches.find((m) => m.id !== t.id) || dpMatches[1];
        addFinding(
          'Requires review',
          'Possible Duplicate Transaction',
          t,
          `Identical transaction amount of ${formatInr(t.amount)} recorded for ${t.party} within the review period.`,
          `Two or more vouchers for ${t.party} have identical amounts (${formatInr(t.amount)}). One on ${t.date} (Vch: ${t.voucherNumber}) and another on ${duplicateTx.date} (Vch: ${duplicateTx.voucherNumber}).`,
          `Check vendor bill copy or bank statement to confirm whether two independent supplies occurred or if an entry was booked twice.`
        );
      }
    }

    // 4, 5 & 6. Unusual Transaction Amount (Outlier vs. Historical Average)
    const partyStats = partyAverageMap.get(partyLower);
    if (partyStats && partyStats.count >= 2) {
      const otherAmounts = (partyAmountsMap.get(partyLower) || []).filter((a) => a !== t.amount);
      if (otherAmounts.length > 0) {
        const histAvg = otherAmounts.reduce((a, b) => a + b, 0) / otherAmounts.length;
        if (t.amount > histAvg * 3.5 && t.amount > 100000) {
          const isPurchase = vchTypeLower.includes('purchase') || vchTypeLower.includes('bill') || vchTypeLower.includes('payment');
          const issueType = isPurchase ? 'Unusual Vendor Transaction' : 'Unusual Customer Transaction';
          addFinding(
            'Requires review',
            issueType,
            t,
            `Transaction amount of ${formatInr(t.amount)} is unusually higher than the historical average (${formatInr(histAvg)}) for ${t.party}.`,
            `The transaction is ${(t.amount / histAvg).toFixed(1)}x greater than typical transactions recorded for this counterparty.`,
            `Verify underlying purchase order, contract, delivery challan, or board approval for this high-value transaction.`
          );
        }
      }
    }

    // 7. Missing GSTIN on B2B Taxable Transactions
    const isB2B = (vchTypeLower.includes('sale') || vchTypeLower.includes('purchase') || vchTypeLower.includes('tax')) &&
                  t.taxableValue > 0 &&
                  !partyLower.includes('cash') &&
                  !partyLower.includes('unregistered') &&
                  !partyLower.includes('consumer');
    
    if (isB2B && (!t.gstin || t.gstin.trim() === '')) {
      addFinding(
        'Critical',
        'Missing GSTIN on Taxable Transaction',
        t,
        `Taxable transaction of ${formatInr(t.taxableValue)} booked for ${t.party} without a valid GSTIN.`,
        `GST credit cannot be availed by recipient or reported properly in GSTR-1/GSTR-3B table 4 without the counterparty's 15-digit GSTIN.`,
        `Obtain the party's GST registration certificate or update the master ledger with their verified GSTIN.`
      );
    } else if (t.gstin && t.gstin.trim() !== '' && !GSTIN_REGEX.test(t.gstin.trim().toUpperCase())) {
      addFinding(
        'Requires review',
        'Invalid GSTIN Format',
        t,
        `GSTIN "${t.gstin}" for party ${t.party} does not conform to standard 15-character statutory format.`,
        `Invalid GSTIN will cause portal rejection during GSTR-1/GSTR-2B matching and JSON export errors.`,
        `Verify the 15-digit GSTIN on the GST portal (www.gst.gov.in) and rectify in master.`
      );
    }

    // 8. GST Calculation Mismatches
    const totalGst = (t.cgst || 0) + (t.sgst || 0) + (t.igst || 0);
    if (t.taxableValue > 0 && totalGst > 0) {
      const calculatedRate = (totalGst / t.taxableValue) * 100;
      const standardRates = [5, 12, 18, 28, 0.1, 0.25, 1.5, 3];
      const closestRate = standardRates.find((r) => Math.abs(r - calculatedRate) < 0.35);

      if (closestRate) {
        const expectedGst = (t.taxableValue * closestRate) / 100;
        const diff = Math.abs(expectedGst - totalGst);
        if (diff > 5 && diff / expectedGst > 0.02) {
          addFinding(
            'Critical',
            'GST Calculation Mismatch',
            t,
            `Tax amount calculated (${formatInr(totalGst)}) differs from expected tax (${formatInr(expectedGst)} @ ${closestRate}%) on taxable value of ${formatInr(t.taxableValue)}.`,
            `Potential rounding error, incorrect tax slab mapping, or manual override in voucher ledger posting.`,
            `Recheck tax invoice rate items and recompute CGST/SGST/IGST breakdown.`
          );
        }
      } else if (calculatedRate > 35) {
        addFinding(
          'Critical',
          'Anomalous Tax Rate Detected',
          t,
          `Apparent GST rate (${calculatedRate.toFixed(1)}%) exceeds maximum statutory GST slab of 28%.`,
          `Taxable value ${formatInr(t.taxableValue)} with total tax ${formatInr(totalGst)} indicates possible inverted base value or combined ledger posting.`,
          `Verify assessable taxable base value and check whether freight/duties were omitted from taxable value.`
        );
      }
    }

    // 9. CGST/SGST/IGST Inconsistencies
    // Case A: Both IGST and CGST/SGST booked on the same voucher
    if (t.igst > 0 && (t.cgst > 0 || t.sgst > 0)) {
      addFinding(
        'Critical',
        'CGST/SGST and IGST Inconsistency',
        t,
        `Voucher contains both Inter-state Tax (IGST: ${formatInr(t.igst)}) and Intra-state Tax (CGST: ${formatInr(t.cgst)}, SGST: ${formatInr(t.sgst)}).`,
        `A supply must be either intra-state (CGST + SGST) or inter-state (IGST), but cannot legally attract both unless multiple supply items with different jurisdictions exist.`,
        `Inspect invoice line items to ensure place of supply matches tax type.`
      );
    }
    // Case B: CGST != SGST on intra-state transaction
    if (t.cgst > 0 && t.sgst > 0 && Math.abs(t.cgst - t.sgst) > 2) {
      addFinding(
        'Requires review',
        'CGST and SGST Rate Asymmetry',
        t,
        `CGST (${formatInr(t.cgst)}) and SGST (${formatInr(t.sgst)}) are unequal.`,
        `Under GST law, CGST and SGST rates must be strictly equal (50% each of total intra-state tax).`,
        `Verify ledger posting in software and adjust discrepancy.`
      );
    }

    // 10. Negative Balances / Inverted Values
    if (t.amount < 0 || t.taxableValue < 0 || t.debit < 0 || t.credit < 0) {
      addFinding(
        'Requires review',
        'Negative Transaction Value',
        t,
        `Voucher recorded with negative numerical amount (${formatInr(t.amount)}).`,
        `Negative postings often represent manual journal overrides or incorrect debit/credit entry instead of proper Credit Note/Debit Note voucher type.`,
        `Verify whether a Credit Note (Form GSTR-1 Table 9B) should be booked instead of negative journal entry.`
      );
    }

    // 11. Suspense Account Movements
    const isSuspense = ledgerLower.includes('suspense') ||
                       partyLower.includes('suspense') ||
                       descLower.includes('suspense') ||
                       ledgerLower.includes('miscellaneous account') ||
                       ledgerLower.includes('unallocated');
    if (isSuspense) {
      addFinding(
        'Critical',
        'Suspense Account Movement',
        t,
        `Transaction of ${formatInr(t.amount)} posted to Suspense or Unallocated account.`,
        `Suspense entries indicate unidentifiable payments, missing party particulars, or unreconciled bank clearing items that distort balance sheets.`,
        `Obtain counterparty bank advice, trace party ledger, and reclassify the entry before finalizing accounts.`
      );
    }

    // 12. Large Journal Entries
    if (vchTypeLower.includes('journal') && t.amount >= 200000) {
      addFinding(
        'Requires review',
        'Large Journal Entry Adjustment',
        t,
        `High-value Journal voucher of ${formatInr(t.amount)} passed without cash or bank movement.`,
        `Substantial manual non-cash journal entries bypass standard billing/banking controls and require senior review and audit trail verification.`,
        `Verify supporting approval note, management authorization, and underlying adjustment reason.`
      );
    }

    // 13. Unusual Expense Transactions / Cash limit > ₹10,000 Sec 40A(3)
    if (t.isCash && t.amount > 10000) {
      addFinding(
        'Critical',
        'Cash Payment Over Statutory Limit',
        t,
        `Cash payment of ${formatInr(t.amount)} exceeds statutory threshold of ₹10,000 per day per person.`,
        `Under Section 40A(3) of the Income Tax Act, cash payments exceeding ₹10,000 are disallowed as deductible business expenses unless covered under Rule 6DD exemptions.`,
        `Verify mode of payment. If paid by cheque/NEFT, correct the payment ledger from Cash to Bank immediately.`
      );
    }

    // 14 & 15. Unusual Ledger Postings / Missing Party
    if ((vchTypeLower.includes('sale') || vchTypeLower.includes('purchase')) &&
        (partyLower === 'general account' || partyLower === 'unknown party' || partyLower === '')) {
      addFinding(
        'Observation',
        'Missing Counterparty Details',
        t,
        `Voucher recorded without named counterparty customer or vendor.`,
        `Vouchers booked against generic ledger accounts hinder party reconciliation and statutory GST matching.`,
        `Tag the specific party ledger to this transaction.`
      );
    }

    // 16. Missing or Inconsistent Transaction Information
    if (t.amount > 50000 && (!t.description || t.description.trim().length < 5)) {
      addFinding(
        'Observation',
        'Missing Narration on High-Value Transaction',
        t,
        `Transaction of ${formatInr(t.amount)} has no explanatory narration or memo.`,
        `Auditing standards require informative narration for material transactions to explain business purpose.`,
        `Add specific narration detailing invoice reference, project, or business rationale.`
      );
    }

    // 17. Round-Number Transaction Patterns
    const isRoundLakh = t.amount >= 100000 && t.amount % 50000 === 0 &&
                        (vchTypeLower.includes('expense') || vchTypeLower.includes('journal') || vchTypeLower.includes('payment'));
    if (isRoundLakh && !partyLower.includes('bank') && !descLower.includes('salary')) {
      addFinding(
        'Observation',
        'Round-Number Transaction Pattern',
        t,
        `Exact round-number transaction of ${formatInr(t.amount)} recorded.`,
        `Large exact round-figure expense or payment postings (e.g. ₹1,00,000 or ₹5,00,000) can indicate ad-hoc estimates, advances, or round-sum provisions requiring supporting invoices.`,
        `Check whether an itemized tax invoice exists or if this represents an advance requiring subsequent bill settlement.`
      );
    }
  }

  // Summary counts
  const criticalIssues = findings.filter((f) => f.severity === 'Critical').length;
  const requiresReview = findings.filter((f) => f.severity === 'Requires review').length;
  const observations = findings.filter((f) => f.severity === 'Observation').length;
  const totalFlaggedAmount = findings.reduce((sum, f) => sum + f.amount, 0);

  const summary: ReviewSummary = {
    company: companyName,
    software,
    periodFrom: periodFrom || (txList[0]?.date ?? '2024-04-01'),
    periodTo: periodTo || (txList[txList.length - 1]?.date ?? '2025-03-31'),
    transactionsAnalysed: txList.length,
    criticalIssues,
    requiresReview,
    observations,
    totalFlaggedAmount,
    runTimestamp: new Date().toISOString(),
  };

  return {
    summary,
    findings,
    transactions: txList,
  };
}

export function formatInr(amount: number): string {
  if (isNaN(amount)) return '₹0';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const parts = absAmount.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian numbering system: 3 digits, then groups of 2 digits
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹${formattedInteger}${decimalPart !== '00' ? '.' + decimalPart : ''}`;
}
