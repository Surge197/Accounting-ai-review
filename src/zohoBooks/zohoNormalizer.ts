import { AccountingTransaction } from '../normalizer/commonModel';
import { parseUniversalFile } from '../parser/universalParser';

/**
 * Normalizes Zoho Books exported CSV, Excel, or JSON data into the canonical transaction model.
 */
export function parseZohoData(
  content: string | ArrayBuffer,
  fileName: string,
  companyName: string
): AccountingTransaction[] {
  const parsed = parseUniversalFile(content, fileName);
  const rows = parsed.rows;
  if (!rows || rows.length === 0) return [];

  return rows.map((row, index) => {
    // Case-insensitive key retriever
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        for (const rowKey of Object.keys(row)) {
          if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
            return String(row[rowKey] ?? '').trim();
          }
        }
      }
      return '';
    };

    const getNum = (...keys: string[]): number => {
      const val = getVal(...keys);
      if (!val) return 0;
      const clean = val.replace(/,/g, '').replace(/[^\d.-]/g, '');
      const parsedNum = parseFloat(clean);
      return isNaN(parsedNum) ? 0 : parsedNum;
    };

    // Date
    const rawDate = getVal(
      'invoice date',
      'bill date',
      'date',
      'transaction date',
      'payment date',
      'journal date'
    );
    const date = normalizeZohoDate(rawDate);

    // Voucher Number & Type
    const invNo = getVal('invoice number', 'invoice#', 'bill number', 'bill#', 'journal number', 'transaction#', 'reference#');
    const voucherNumber = invNo || `ZB-${index + 1}`;

    let voucherType = getVal('transaction type', 'voucher type', 'type');
    if (!voucherType) {
      if (getVal('invoice number', 'invoice#')) voucherType = 'Sales Invoice';
      else if (getVal('bill number', 'bill#')) voucherType = 'Purchase Bill';
      else if (getVal('journal number')) voucherType = 'Journal';
      else voucherType = 'General Voucher';
    }

    // Party & Ledger
    const party = getVal(
      'customer name',
      'vendor name',
      'contact name',
      'entity name',
      'party name',
      'account'
    ) || 'General Account';

    const ledger = getVal(
      'account name',
      'item name',
      'product name',
      'expense account',
      'income account'
    ) || voucherType;

    const description = getVal(
      'notes',
      'description',
      'customer notes',
      'item description',
      'narration',
      'memo'
    );

    const gstin = getVal(
      'gst identification number (gstin)',
      'gstin',
      'tax identification number',
      'party gstin',
      'gst no'
    );

    const reference = getVal('reference number', 'reference#', 'order number', 'po#', 'invoice#');

    // Values
    let amount = getNum('total', 'amount', 'bcy total', 'invoice amount', 'bill amount', 'net amount');
    let taxableValue = getNum('sub total', 'taxable amount', 'item total', 'base amount');
    const cgst = getNum('cgst amount', 'cgst', 'central gst');
    const sgst = getNum('sgst amount', 'sgst', 'state gst', 'utgst');
    const igst = getNum('igst amount', 'igst', 'integrated gst');

    const debit = getNum('debit', 'debit amount', 'bcy debit');
    const credit = getNum('credit', 'credit amount', 'bcy credit');

    if (amount === 0) {
      amount = Math.max(debit, credit);
    }
    if (taxableValue === 0) {
      const sumTax = cgst + sgst + igst;
      taxableValue = sumTax > 0 && amount > sumTax ? amount - sumTax : amount;
    }

    const isCash = (party + ' ' + ledger + ' ' + description).toLowerCase().includes('cash');

    return {
      id: `zoho-${index + 1}-${voucherNumber}`,
      date,
      voucherType,
      voucherNumber,
      party,
      ledger,
      description,
      debit: debit || (voucherType.toLowerCase().includes('bill') ? amount : 0),
      credit: credit || (voucherType.toLowerCase().includes('invoice') ? amount : 0),
      amount,
      taxableValue,
      cgst,
      sgst,
      igst,
      gstin,
      reference,
      sourceSoftware: 'Zoho Books',
      companyName,
      isCash,
      rawRecord: row,
    };
  });
}

function normalizeZohoDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const trimmed = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY or DD-MM-YYYY
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // DD-MM-YYYY or MM-DD-YYYY: standard Indian/Zoho export is DD/MM/YYYY
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }

  return trimmed;
}
