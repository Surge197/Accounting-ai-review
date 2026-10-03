import * as XLSX from 'xlsx';
import { ReviewReport } from '../normalizer/commonModel';

export function downloadExcelReport(report: ReviewReport) {
  const { summary, findings, transactions } = report;

  const workbook = XLSX.utils.book_new();

  // 1. Sheet: Summary & Findings
  const summaryRows = [
    ['ACCOUNTING REVIEW REPORT'],
    [],
    ['Company:', summary.company],
    ['Software:', summary.software],
    ['Period:', `${summary.periodFrom} to ${summary.periodTo}`],
    ['Generated At:', new Date(summary.runTimestamp).toLocaleString()],
    [],
    ['Transactions Analysed:', summary.transactionsAnalysed],
    ['Critical Issues:', summary.criticalIssues],
    ['Requires Review:', summary.requiresReview],
    ['Observations:', summary.observations],
    ['Total Flagged Amount:', summary.totalFlaggedAmount],
    [],
    ['FINDINGS DETAIL'],
    [
      'Finding ID',
      'Severity',
      'Issue Type',
      'Company',
      'Date',
      'Voucher / Invoice #',
      'Party',
      'Amount (INR)',
      'Explanation',
      'Reason for Flagging',
      'AI Explanation',
      'Suggested Verification / Action',
    ],
  ];

  const findingsRows = findings.map((f) => [
    f.id,
    f.severity,
    f.issueType,
    f.company,
    f.date,
    f.voucherNumber,
    f.party,
    f.amount,
    f.explanation,
    f.reason,
    f.aiExplanation || '',
    f.suggestedAction,
  ]);

  const disclaimerRows = [
    [],
    ['AI-generated analysis is for accounting review assistance only. Final verification must be performed by an authorized accounting professional.'],
  ];

  const combinedSummaryAndFindings = [...summaryRows, ...findingsRows, ...disclaimerRows];
  const wsSummary = XLSX.utils.aoa_to_sheet(combinedSummaryAndFindings);

  // Set column widths
  wsSummary['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 24 },
    { wch: 12 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 40 },
    { wch: 45 },
    { wch: 50 },
    { wch: 45 },
  ];

  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Accounting Review');

  // 2. Sheet: All Transactions
  const txHeaders = [
    'ID',
    'Date',
    'Voucher Type',
    'Voucher No',
    'Party',
    'Ledger',
    'Description / Narration',
    'Amount',
    'Taxable Value',
    'CGST',
    'SGST',
    'IGST',
    'GSTIN',
    'Reference',
    'Software',
  ];

  const txData = transactions.map((t) => [
    t.id,
    t.date,
    t.voucherType,
    t.voucherNumber,
    t.party,
    t.ledger,
    t.description,
    t.amount,
    t.taxableValue,
    t.cgst,
    t.sgst,
    t.igst,
    t.gstin,
    t.reference,
    t.sourceSoftware,
  ]);

  const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txData]);
  wsTx['!cols'] = [
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    { wch: 35 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(workbook, wsTx, 'Analysed Transactions');

  const safeCompanyName = summary.company.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const fileName = `Accounting_AI_Review_${safeCompanyName}_${summary.periodFrom}_${summary.periodTo}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
