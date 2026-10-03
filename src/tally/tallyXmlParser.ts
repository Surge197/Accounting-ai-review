import { AccountingTransaction } from '../normalizer/commonModel';

/**
 * Parses Tally XML DOM to extract VOUCHER entries and converts to normalized AccountingTransaction
 */
export function parseTallyXmlDoc(xmlDoc: Document, companyName: string): AccountingTransaction[] {
  const transactions: AccountingTransaction[] = [];
  const vouchers = xmlDoc.getElementsByTagName('VOUCHER');

  for (let i = 0; i < vouchers.length; i++) {
    const vch = vouchers[i];

    // Helper to get text of first element by tag
    const getText = (tag: string): string => {
      const el = vch.getElementsByTagName(tag)[0];
      return el ? el.textContent?.trim() || '' : '';
    };

    // Date in Tally XML is often YYYYMMDD or YYYY-MM-DD
    const rawDate = getText('DATE') || getText('VOUCHERDATE');
    let formattedDate = rawDate;
    if (rawDate && /^\d{8}$/.test(rawDate)) {
      formattedDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    }

    const voucherType = getText('VOUCHERTYPENAME') || vch.getAttribute('VCHTYPE') || getText('VCHTYPE') || 'Journal';
    const voucherNumber = getText('VOUCHERNUMBER') || getText('REFERENCE') || `VCH-${i + 1}`;
    const party = getText('PARTYLEDGERNAME') || getText('PARTYNAME') || getText('BASICBUYERNAME') || 'Unknown Party';
    const gstin = getText('PARTYGSTIN') || getText('PARTYGSTINNO') || getText('GSTIN') || '';
    const description = getText('NARRATION') || getText('NARRATION.LIST') || '';
    const reference = getText('REFERENCE') || getText('INVOICENUMBER') || '';

    // Parse ledger entries
    const ledgerEntries = vch.getElementsByTagName('ALLLEDGERENTRIES.LIST');
    let debit = 0;
    let credit = 0;
    let taxableValue = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let mainLedger = '';
    let maxAmount = 0;

    for (let j = 0; j < ledgerEntries.length; j++) {
      const entry = ledgerEntries[j];
      const entryLedger = entry.getElementsByTagName('LEDGERNAME')[0]?.textContent?.trim() || '';
      const amtStr = entry.getElementsByTagName('AMOUNT')[0]?.textContent?.trim() || '0';
      const amtVal = parseFloat(amtStr) || 0;
      const isPositive = entry.getElementsByTagName('ISDEEMEDPOSITIVE')[0]?.textContent?.trim()?.toLowerCase() === 'yes';

      const lowerLedger = entryLedger.toLowerCase();
      if (lowerLedger.includes('cgst') || lowerLedger.includes('central tax')) {
        cgst += Math.abs(amtVal);
      } else if (lowerLedger.includes('sgst') || lowerLedger.includes('state tax') || lowerLedger.includes('utgst')) {
        sgst += Math.abs(amtVal);
      } else if (lowerLedger.includes('igst') || lowerLedger.includes('integrated tax')) {
        igst += Math.abs(amtVal);
      } else if (lowerLedger.includes('sales') || lowerLedger.includes('purchase')) {
        taxableValue += Math.abs(amtVal);
        if (!mainLedger) mainLedger = entryLedger;
      } else if (!lowerLedger.includes(party.toLowerCase())) {
        if (!mainLedger) mainLedger = entryLedger;
      }

      if (amtVal < 0) {
        debit += Math.abs(amtVal);
      } else {
        credit += Math.abs(amtVal);
      }

      if (Math.abs(amtVal) > maxAmount && entryLedger !== party) {
        maxAmount = Math.abs(amtVal);
        if (!mainLedger) mainLedger = entryLedger;
      }
    }

    const netAmount = Math.max(debit, credit) || maxAmount || taxableValue + cgst + sgst + igst || 0;
    if (taxableValue === 0 && (cgst > 0 || sgst > 0 || igst > 0)) {
      taxableValue = Math.max(0, netAmount - (cgst + sgst + igst));
    }

    transactions.push({
      id: `tally-${i + 1}-${voucherNumber}`,
      date: formattedDate || '2024-04-01',
      voucherType,
      voucherNumber,
      party: party || 'General Ledger',
      ledger: mainLedger || voucherType,
      description,
      debit,
      credit,
      amount: netAmount,
      taxableValue: taxableValue || netAmount,
      cgst,
      sgst,
      igst,
      gstin,
      reference,
      sourceSoftware: 'TallyPrime',
      companyName,
      isCash: (mainLedger + ' ' + description).toLowerCase().includes('cash'),
    });
  }

  return transactions;
}
