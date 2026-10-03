import * as XLSX from 'xlsx';

export interface ParsedRawData {
  format: 'csv' | 'xlsx' | 'xml' | 'json';
  rows: Record<string, any>[];
  rawXml?: Document;
  error?: string;
}

/**
 * Universal file parser supporting CSV, Excel (.xlsx/.xls), Tally XML, and JSON.
 */
export function parseUniversalFile(
  content: string | ArrayBuffer,
  fileName: string
): ParsedRawData {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  try {
    if (extension === 'xlsx' || extension === 'xls' || (content instanceof ArrayBuffer && extension !== 'xml')) {
      const data = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
      const workbook = XLSX.read(data, { type: content instanceof ArrayBuffer ? 'array' : 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      return {
        format: 'xlsx',
        rows,
      };
    }

    const textContent = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);

    if (extension === 'json') {
      const parsed = JSON.parse(textContent);
      const rows = Array.isArray(parsed) ? parsed : (parsed.transactions || parsed.vouchers || parsed.data || [parsed]);
      return {
        format: 'json',
        rows,
      };
    }

    if (extension === 'xml' || textContent.trim().startsWith('<')) {
      // Browser DOMParser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(textContent, 'text/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        throw new Error('Failed to parse XML: ' + parserError[0].textContent);
      }
      return {
        format: 'xml',
        rows: [],
        rawXml: xmlDoc,
      };
    }

    // Default to CSV
    const rows = parseCsvText(textContent);
    return {
      format: 'csv',
      rows,
    };
  } catch (err: any) {
    return {
      format: 'csv',
      rows: [],
      error: err.message || 'Error parsing file',
    };
  }
}

/**
 * Robust RFC-4180 compliant CSV parser
 */
export function parseCsvText(csvText: string): Record<string, any>[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\r' && nextChar === '\n') || char === '\n' || char === '\r') {
      if (inQuotes) {
        current += '\n';
      } else {
        if (current.trim()) lines.push(current);
        current = '';
        if (char === '\r' && nextChar === '\n') i++;
      }
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    lines.push(current);
  }

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().replace(/^[\uFEFF]/, ''));
  const result: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row: Record<string, any> = {};
    let hasValue = false;

    headers.forEach((header, idx) => {
      const val = values[idx] !== undefined ? values[idx].trim() : '';
      row[header] = val;
      if (val !== '') hasValue = true;
    });

    if (hasValue) {
      result.push(row);
    }
  }

  return result;
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}
