import { AccountingTransaction } from '../normalizer/commonModel';
import { parseUniversalFile } from '../parser/universalParser';
import { parseTallyXmlDoc } from './tallyXmlParser';

/**
 * Normalizes TallyPrime data from XML, CSV, Excel, or JSON into the common transaction model.
 */
export function parseTallyData(
  content: string | ArrayBuffer,
  fileName: string,
  companyName: string
): AccountingTransaction[] {
  const parsed = parseUniversalFile(content, fileName);

  if (parsed.format === 'xml' && parsed.rawXml) {
    return parseTallyXmlDoc(parsed.rawXml, companyName);
  }

  // Handle tabular data (CSV, XLSX, JSON)
  const rows = parsed.rows;
  if (!rows || rows.length === 0) return [];

  return rows.map((row, index) => {
    // Find matching keys case-insensitively
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

    // Extract fields
    const rawDate = getVal('date', 'vch date', 'voucher date', 'txn date', 'bill date', 'dt');
    let date = normalizeDateString(rawDate);

    const voucherType = getVal('vch type', 'voucher type', 'type', 'vouchertype') || 'Journal';
    const voucherNumber = getVal('vch no', 'voucher no', 'voucher number', 'invoice no', 'inv no', 'bill no', 'ref no') || `VCH-${index + 1}`;
    const party = getVal('particulars', 'party', 'party name', 'party ledger', 'customer name', 'vendor name', 'ledger name') || 'General Account';
    const ledger = getVal('ledger', 'account', 'expense account', 'income account', 'sales ledger', 'purchase ledger') || voucherType;
    const description = getVal('narration', 'description', 'remarks', 'note', 'memo');
    const gstin = getVal('gstin', 'gstin/uin', 'party gstin', 'tax id', 'gst no');
    const reference = getVal('reference', 'ref', 'po no', 'bill ref', 'order no');

    const debit = getNum('debit', 'debit amount', 'dr amount', 'dr');
    const credit = getNum('credit', 'credit amount', 'cr amount', 'cr');
    let amount = getNum('amount', 'net amount', 'total', 'grand total', 'value');
    if (amount === 0) {
      amount = Math.max(debit, credit);
    }

    let taxableValue = getNum('taxable value', 'taxable amount', 'base amount', 'assessable value');
    const cgst = getNum('cgst', 'central tax', 'cgst amount');
    const sgst = getNum('sgst', 'state tax', 'sgst amount', 'utgst');
    const igst = getNum('igst', 'integrated tax', 'igst amount');

    if (taxableValue === 0) {
      const totalGst = cgst + sgst + igst;
      if (totalGst > 0 && amount > totalGst) {
        taxableValue = amount - totalGst;
      } else {
        taxableValue = amount;
      }
    }

    const isCash = (party + ' ' + ledger + ' ' + description).toLowerCase().includes('cash');

    return {
      id: `tally-${index + 1}-${voucherNumber}`,
      date,
      voucherType,
      voucherNumber,
      party,
      ledger,
      description,
      debit,
      credit,
      amount,
      taxableValue,
      cgst,
      sgst,
      igst,
      gstin,
      reference,
      sourceSoftware: 'TallyPrime',
      companyName,
      isCash,
      rawRecord: row,
    };
  });
}

function normalizeDateString(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  const trimmed = dateStr.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // DD-Mon-YYYY e.g. 01-Apr-2024
  const monMatch = trimmed.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})$/);
  if (monMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const day = monMatch[1].padStart(2, '0');
    const month = months[monMatch[2].toLowerCase()] || '01';
    const year = monMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  return trimmed;
}
