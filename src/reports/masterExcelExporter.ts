import * as XLSX from 'xlsx';
import { ConsolidatedPortfolioReport, ClientCompany } from '../clients/clientModel';

export function downloadMasterExcelReport(
  portfolio: ConsolidatedPortfolioReport,
  clients: ClientCompany[]
) {
  const workbook = XLSX.utils.book_new();

  // ==========================================
  // SHEET 1: Executive Portfolio Summary
  // ==========================================
  const summaryRows: any[][] = [
    ['ACCOUNTING AI REVIEW - MASTER MULTI-CLIENT CONSOLIDATED REPORT'],
    ['Generated At:', new Date(portfolio.runTimestamp).toLocaleString()],
    [],
    ['PORTFOLIO AUDIT METRICS'],
    ['Total Clients In Portfolio:', portfolio.totalClients],
    ['Total Clients Reviewed:', portfolio.totalClientsReviewed],
    ['Successful Client Syncs:', portfolio.successfulCount],
    ['Failed Client Syncs:', portfolio.failedCount],
    ['Skipped / Inactive Clients:', portfolio.skippedCount],
    ['Total Transactions Analysed:', portfolio.totalTransactions],
    ['Critical Issues Flagged:', portfolio.criticalIssues],
    ['Requires Review Items:', portfolio.requiresReview],
    ['Observations:', portfolio.observations],
    ['Total Flagged Amount (INR):', portfolio.totalFlaggedAmount],
    [],
    ['EXECUTIVE AUDIT SUMMARY & SYSTEMIC RISKS'],
    [portfolio.executiveAiSummary || 'Automated rule analysis completed across portfolio.'],
    [],
    ['CLIENT COMPARISON MATRIX'],
    [
      'Client Name',
      'Software',
      'Data Source',
      'Sync Status',
      'Snapshot Diff',
      'Transactions Analysed',
      'Critical Issues',
      'Requires Review',
      'Observations',
      'Flagged Amount (INR)',
      'Risk Classification',
    ],
  ];

  portfolio.clientSummaries.forEach((c) => {
    summaryRows.push([
      c.clientName,
      c.software,
      c.dataSourceType,
      c.syncStatus,
      c.snapshotDiffSummary || 'Baseline',
      c.transactionsCount,
      c.criticalCount,
      c.reviewCount,
      c.observationCount,
      c.flaggedAmount,
      c.riskScore,
    ]);
  });

  // If there are failures, add a dedicated failure section
  const failedClients = clients.filter((c) => c.reviewStatus === 'FAILED');
  if (failedClients.length > 0) {
    summaryRows.push([]);
    summaryRows.push(['DATA COLLECTION / SYNC FAILURES']);
    summaryRows.push(['Client Name', 'Software', 'Source Mode', 'Error Reason']);
    failedClients.forEach((f) => {
      summaryRows.push([
        f.name,
        f.software,
        f.dataSourceType,
        f.errorMessage || 'Connection or parser failure',
      ]);
    });
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 36 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Portfolio Summary');

  // ==========================================
  // SHEET 2: Consolidated Findings (All Clients)
  // ==========================================
  const findingsRows: any[][] = [
    [
      'Client Name',
      'Software',
      'Data Source',
      'Finding ID',
      'Severity',
      'Issue Type',
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

  portfolio.allFindings.forEach((f) => {
    findingsRows.push([
      f.clientName,
      f.software,
      f.source || 'SAMPLE',
      f.id,
      f.severity,
      f.issueType,
      f.date,
      f.voucherNumber,
      f.party,
      f.amount,
      f.explanation,
      f.reason,
      f.aiExplanation || '',
      f.suggestedAction,
    ]);
  });

  const wsFindings = XLSX.utils.aoa_to_sheet(findingsRows);
  wsFindings['!cols'] = [
    { wch: 32 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 40 },
    { wch: 45 },
    { wch: 50 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsFindings, 'Consolidated Findings');

  // ==========================================
  // SHEETS 3..N: Individual Client Sheets
  // ==========================================
  clients.forEach((c) => {
    if (!c.latestReport || c.transactions.length === 0) return;

    const sanitizedTitle = c.name.substring(0, 28).replace(/[\\/?*[\]]/g, '');
    const clientRows: any[][] = [
      [`CLIENT AUDIT REPORT: ${c.name}`],
      [`Software: ${c.software} | Source: ${c.dataSourceType} | Period: ${c.periodFrom} to ${c.periodTo}`],
      [],
      ['FINDINGS FOR THIS CLIENT'],
      [
        'ID',
        'Severity',
        'Issue Type',
        'Date',
        'Voucher #',
        'Party',
        'Amount (INR)',
        'Explanation',
        'Reason',
        'AI Explanation',
        'Action',
      ],
    ];

    c.latestReport.findings.forEach((f) => {
      clientRows.push([
        f.id,
        f.severity,
        f.issueType,
        f.date,
        f.voucherNumber,
        f.party,
        f.amount,
        f.explanation,
        f.reason,
        f.aiExplanation || '',
        f.suggestedAction,
      ]);
    });

    clientRows.push([]);
    clientRows.push(['TRANSACTIONS']);
    clientRows.push([
      'Date',
      'Voucher Type',
      'Voucher #',
      'Party',
      'Ledger',
      'Debit',
      'Credit',
      'Amount',
      'Taxable Value',
      'CGST',
      'SGST',
      'IGST',
      'GSTIN',
      'Source',
    ]);

    c.transactions.forEach((tx) => {
      clientRows.push([
        tx.date,
        tx.voucherType,
        tx.voucherNumber,
        tx.party,
        tx.ledger,
        tx.debit,
        tx.credit,
        tx.amount,
        tx.taxableValue,
        tx.cgst,
        tx.sgst,
        tx.igst,
        tx.gstin,
        tx.source || c.dataSourceType,
      ]);
    });

    const wsClient = XLSX.utils.aoa_to_sheet(clientRows);
    XLSX.utils.book_append_sheet(workbook, wsClient, sanitizedTitle);
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `MultiClient_Accounting_Review_Report_${dateStr}.xlsx`);
}
