import { AccountingTransaction } from '../normalizer/commonModel';

export interface TransactionDiffItem {
  before: AccountingTransaction;
  after: AccountingTransaction;
  changedFields: string[];
}

export interface SnapshotDiff {
  added: AccountingTransaction[];
  modified: TransactionDiffItem[];
  deleted: AccountingTransaction[];
  unchanged: AccountingTransaction[];
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
  unchangedCount: number;
}

export interface ClientSnapshot {
  id: string;
  clientId: string;
  clientName: string;
  timestamp: string;
  sourceType: 'LIVE' | 'FILE';
  transactionCount: number;
  transactions: AccountingTransaction[];
  diffFromPrevious?: SnapshotDiff;
  hash: string;
}

/**
 * Generate a consistent identifier for a transaction to track across syncs
 */
export function getTransactionSignature(tx: AccountingTransaction): string {
  if (tx.sourceTransactionId) {
    return `${tx.voucherType}:${tx.sourceTransactionId}`;
  }
  return `${tx.voucherType}:${tx.voucherNumber.trim().toUpperCase()}:${tx.date}:${tx.party.trim().toLowerCase()}`;
}

/**
 * Detects fields that have changed between two versions of the same transaction
 */
function getChangedFields(a: AccountingTransaction, b: AccountingTransaction): string[] {
  const fields: string[] = [];
  if (a.amount !== b.amount) fields.push(`Amount (${a.amount} -> ${b.amount})`);
  if (a.debit !== b.debit) fields.push(`Debit (${a.debit} -> ${b.debit})`);
  if (a.credit !== b.credit) fields.push(`Credit (${a.credit} -> ${b.credit})`);
  if (a.taxableValue !== b.taxableValue) fields.push(`Taxable Value (${a.taxableValue} -> ${b.taxableValue})`);
  if (a.cgst !== b.cgst || a.sgst !== b.sgst || a.igst !== b.igst) fields.push('Tax Amounts (CGST/SGST/IGST)');
  if (a.ledger !== b.ledger) fields.push(`Ledger (${a.ledger} -> ${b.ledger})`);
  if (a.gstin !== b.gstin) fields.push(`GSTIN (${a.gstin} -> ${b.gstin})`);
  if (a.description !== b.description) fields.push('Narration/Description');
  return fields;
}

/**
 * Creates a deterministic checksum/hash representation of transactions
 */
export function hashTransactions(transactions: AccountingTransaction[]): string {
  let sum = 0;
  for (const t of transactions) {
    sum = (sum * 31 + t.amount + t.debit + t.credit) % 1000000007;
  }
  return `hash-${transactions.length}-${sum}`;
}

/**
 * Compares previous client snapshot with newly pulled transactions.
 * Strict client isolation: Assumes both sets belong to the same client!
 */
export function compareTransactionsWithSnapshot(
  previousTransactions: AccountingTransaction[],
  newTransactions: AccountingTransaction[]
): SnapshotDiff {
  const prevMap = new Map<string, AccountingTransaction>();
  for (const tx of previousTransactions) {
    prevMap.set(getTransactionSignature(tx), tx);
  }

  const added: AccountingTransaction[] = [];
  const modified: TransactionDiffItem[] = [];
  const unchanged: AccountingTransaction[] = [];
  const seenSignatures = new Set<string>();

  for (const newTx of newTransactions) {
    const sig = getTransactionSignature(newTx);
    seenSignatures.add(sig);

    const prevTx = prevMap.get(sig);
    if (!prevTx) {
      added.push(newTx);
    } else {
      const changed = getChangedFields(prevTx, newTx);
      if (changed.length > 0) {
        modified.push({
          before: prevTx,
          after: newTx,
          changedFields: changed,
        });
      } else {
        unchanged.push(newTx);
      }
    }
  }

  const deleted: AccountingTransaction[] = [];
  for (const prevTx of previousTransactions) {
    const sig = getTransactionSignature(prevTx);
    if (!seenSignatures.has(sig)) {
      deleted.push(prevTx);
    }
  }

  return {
    added,
    modified,
    deleted,
    unchanged,
    addedCount: added.length,
    modifiedCount: modified.length,
    deletedCount: deleted.length,
    unchangedCount: unchanged.length,
  };
}

/**
 * Creates a new client-specific snapshot recording the diff from previous sync
 */
export function createClientSnapshot(
  clientId: string,
  clientName: string,
  sourceType: 'LIVE' | 'FILE',
  newTransactions: AccountingTransaction[],
  previousSnapshot?: ClientSnapshot
): ClientSnapshot {
  const prevTx = previousSnapshot ? previousSnapshot.transactions : [];
  const diff = compareTransactionsWithSnapshot(prevTx, newTransactions);

  return {
    id: `snap-${clientId}-${Date.now()}`,
    clientId,
    clientName,
    timestamp: new Date().toISOString(),
    sourceType,
    transactionCount: newTransactions.length,
    transactions: newTransactions,
    diffFromPrevious: diff,
    hash: hashTransactions(newTransactions),
  };
}
