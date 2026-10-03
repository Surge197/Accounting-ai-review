import { ReviewFinding, AccountingSoftware } from '../normalizer/commonModel';

/**
 * Calls backend /api/ai/analyze-findings to enrich flagged findings with concise AI explanations.
 */
export async function enrichFindingsWithAi(
  findings: ReviewFinding[],
  companyName: string,
  software: AccountingSoftware
): Promise<ReviewFinding[]> {
  if (findings.length === 0) return findings;

  try {
    const response = await fetch('/api/ai/analyze-findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        findings,
        companyName,
        software,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const explanations: Record<string, string> = data.explanations || {};

    return findings.map((f) => ({
      ...f,
      aiExplanation:
        explanations[f.id] ||
        f.aiExplanation ||
        `This transaction has been flagged based on standard accounting rules. It warrants verification of the source vouchers and party ledgers to confirm compliance and posting accuracy.`,
    }));
  } catch (err: any) {
    console.warn('AI analysis endpoint request failed, using local accounting review explanation:', err);
    return findings.map((f) => ({
      ...f,
      aiExplanation:
        f.aiExplanation ||
        getFallbackAiExplanation(f),
    }));
  }
}

function getFallbackAiExplanation(f: ReviewFinding): string {
  const type = f.issueType.toLowerCase();
  if (type.includes('duplicate invoice') || type.includes('duplicate voucher')) {
    return 'This voucher/invoice number appears multiple times in the records. Review whether this was an accidental duplicate entry or identical sequence across separate fiscal series.';
  }
  if (type.includes('unusual vendor') || type.includes('unusual transaction')) {
    return 'This transaction is noticeably higher than typical baseline entries for this party. It may be a genuine bulk purchase or require verification for incorrect decimal posting or duplication.';
  }
  if (type.includes('missing gstin')) {
    return 'Taxable transaction booked without recipient/supplier GSTIN. Input tax credit (ITC) cannot be claimed under GST Section 16 without valid party registration on portal.';
  }
  if (type.includes('gst calculation') || type.includes('anomalous tax')) {
    return 'Computed tax amount deviates from standard statutory slabs. Check item rates and verify whether exempted items or other charges were grouped under a single tax line.';
  }
  if (type.includes('cash payment')) {
    return 'Cash outflow exceeds the ₹10,000 threshold under Section 40A(3) of the Income Tax Act. Verify if paid via banking channels and rectify cash ledger assignment.';
  }
  if (type.includes('suspense')) {
    return 'Entry posted to Suspense Account. Unreconciled amounts risk balance sheet distortions and should be cleared against confirmed invoices before finalizing review.';
  }
  if (type.includes('large journal')) {
    return 'Substantial non-cash journal voucher passed. Ensure senior accounting authorization and supporting computation papers are attached.';
  }
  return 'Accounting rule engine identified this transaction for verification against supporting bills and party ledger balances.';
}
