/**
 * Accounting AI Review - Canonical Normalized Transaction Model
 * Standardized across TallyPrime and Zoho Books data imports.
 */

export type AccountingSoftware = 'TallyPrime' | 'Zoho Books';

export type FindingSeverity = 'Critical' | 'Requires review' | 'Observation';

export interface AccountingTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  voucherType: string; // Sales, Purchase, Payment, Receipt, Journal, Credit Note, Debit Note, Contra
  voucherNumber: string;
  party: string;
  ledger: string;
  description: string; // Narration
  debit: number;
  credit: number;
  amount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstin: string;
  reference: string;
  sourceSoftware: AccountingSoftware;
  companyName?: string;
  isCash?: boolean;
  rawRecord?: Record<string, any>;
  // Data collection & isolation traceability
  clientId?: string;
  clientName?: string;
  source?: 'LIVE' | 'FILE' | 'SAMPLE';
  sourceTransactionId?: string;
}

export interface ReviewFinding {
  id: string;
  severity: FindingSeverity;
  issueType: string;
  company: string;
  date: string;
  voucherNumber: string;
  party: string;
  amount: number;
  explanation: string;
  reason: string;
  aiExplanation?: string;
  suggestedAction: string;
  transactionId?: string;
  // Traceability
  clientId?: string;
  source?: 'LIVE' | 'FILE' | 'SAMPLE';
}

export interface ReviewSummary {
  company: string;
  software: AccountingSoftware;
  periodFrom: string;
  periodTo: string;
  transactionsAnalysed: number;
  criticalIssues: number;
  requiresReview: number;
  observations: number;
  totalFlaggedAmount: number;
  runTimestamp: string;
}

export interface ReviewReport {
  summary: ReviewSummary;
  findings: ReviewFinding[];
  transactions: AccountingTransaction[];
}
