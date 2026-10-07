import { ConsolidatedPortfolioReport, ClientCompany } from '../clients/clientModel';
import { formatInr } from '../rules/ruleEngine';

export function printMasterPdfReport(
  portfolio: ConsolidatedPortfolioReport,
  clients: ClientCompany[]
) {
  window.print();
}

export function generateMasterReportHtml(
  portfolio: ConsolidatedPortfolioReport,
  clients: ClientCompany[]
): string {
  const failedClients = clients.filter((c) => c.reviewStatus === 'FAILED');

  return `
    <div class="accounting-print-report font-sans text-slate-900 bg-white p-8 max-w-5xl mx-auto">
      <div class="border-b-2 border-slate-900 pb-4 mb-6">
        <h1 class="text-2xl font-bold uppercase tracking-wider text-slate-900">Multi-Client Accounting AI Review - Master Report</h1>
        <p class="text-xs text-slate-500 mt-1">Generated: ${new Date(portfolio.runTimestamp).toLocaleString()} | Consolidated Audit Assessment</p>
      </div>

      <!-- Portfolio Summary Cards -->
      <div class="grid grid-cols-5 gap-3 text-center mb-6">
        <div class="p-3 border border-slate-200 bg-slate-50 rounded">
          <div class="text-[11px] font-semibold text-slate-600 uppercase">Clients Reviewed</div>
          <div class="text-xl font-bold text-slate-900 mt-0.5">${portfolio.totalClientsReviewed} / ${portfolio.totalClients}</div>
          <div class="text-[10px] text-emerald-700 font-semibold">${portfolio.successfulCount} Success · ${portfolio.failedCount} Failed</div>
        </div>
        <div class="p-3 border border-slate-200 bg-slate-50 rounded">
          <div class="text-[11px] font-semibold text-slate-600 uppercase">Transactions</div>
          <div class="text-xl font-bold text-slate-900 mt-0.5">${portfolio.totalTransactions.toLocaleString()}</div>
        </div>
        <div class="p-3 border border-red-200 bg-red-50 rounded">
          <div class="text-[11px] font-semibold text-red-700 uppercase">Critical Issues</div>
          <div class="text-xl font-bold text-red-800 mt-0.5">${portfolio.criticalIssues}</div>
        </div>
        <div class="p-3 border border-amber-200 bg-amber-50 rounded">
          <div class="text-[11px] font-semibold text-amber-700 uppercase">Requires Review</div>
          <div class="text-xl font-bold text-amber-800 mt-0.5">${portfolio.requiresReview}</div>
        </div>
        <div class="p-3 border border-blue-200 bg-blue-50 rounded">
          <div class="text-[11px] font-semibold text-blue-700 uppercase">Flagged Exposure</div>
          <div class="text-lg font-bold text-blue-900 mt-0.5">${formatInr(portfolio.totalFlaggedAmount)}</div>
        </div>
      </div>

      <!-- Executive AI Briefing -->
      ${
        portfolio.executiveAiSummary
          ? `
        <div class="p-4 bg-slate-50 border border-slate-200 rounded mb-6 text-xs text-slate-800 leading-relaxed">
          <div class="font-bold uppercase tracking-wider text-slate-700 mb-1">Executive Audit Summary & Systemic Risks</div>
          <div>${portfolio.executiveAiSummary.replace(/\n\n/g, '<br/><br/>')}</div>
        </div>
      `
          : ''
      }

      <!-- Client Risk Comparison Matrix -->
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3">Client Comparison Matrix</h2>
      <table class="w-full text-left text-xs mb-6 border border-slate-200">
        <thead class="bg-slate-100 text-slate-700">
          <tr>
            <th class="p-2 border">Client Name</th>
            <th class="p-2 border">Software</th>
            <th class="p-2 border">Source</th>
            <th class="p-2 border text-center">Snapshot Diff</th>
            <th class="p-2 border text-center">Tx Count</th>
            <th class="p-2 border text-center">Critical</th>
            <th class="p-2 border text-center">Review</th>
            <th class="p-2 border text-center">Obs</th>
            <th class="p-2 border text-right">Flagged Amount</th>
            <th class="p-2 border text-center">Risk Level</th>
          </tr>
        </thead>
        <tbody>
          ${portfolio.clientSummaries
            .map(
              (c) => `
            <tr>
              <td class="p-2 border font-medium">${c.clientName}</td>
              <td class="p-2 border">${c.software}</td>
              <td class="p-2 border font-mono text-[10px]">${c.dataSourceType}</td>
              <td class="p-2 border text-center font-mono text-[10px]">${c.snapshotDiffSummary || 'Baseline'}</td>
              <td class="p-2 border text-center">${c.transactionsCount}</td>
              <td class="p-2 border text-center font-bold text-red-700">${c.criticalCount}</td>
              <td class="p-2 border text-center font-bold text-amber-700">${c.reviewCount}</td>
              <td class="p-2 border text-center">${c.observationCount}</td>
              <td class="p-2 border text-right">${formatInr(c.flaggedAmount)}</td>
              <td class="p-2 border text-center font-semibold">${c.riskScore}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <!-- Sync Failures if any -->
      ${
        failedClients.length > 0
          ? `
        <h2 class="text-sm font-bold uppercase tracking-wider text-red-700 mb-2">Data Collection & Sync Failures (${failedClients.length})</h2>
        <div class="border border-red-200 rounded bg-red-50 p-3 mb-6 text-xs text-red-800 space-y-1.5">
          ${failedClients
            .map(
              (f) => `
            <div>
              <strong>${f.name}</strong> (${f.software}): ${f.errorMessage || 'Connection failure'}
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      <!-- Top Critical & Review Findings -->
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3">Consolidated Findings (${portfolio.allFindings.length})</h2>
      <div class="space-y-3">
        ${portfolio.allFindings
          .slice(0, 30)
          .map(
            (f) => `
          <div class="border border-slate-200 p-3 rounded text-xs leading-relaxed page-break-inside-avoid">
            <div class="flex items-center justify-between font-semibold mb-1">
              <div>
                <span class="text-slate-900">${f.clientName}</span> · <span class="text-slate-500">${f.software} [${f.source || 'UNKNOWN'}]</span> · <span class="text-slate-700">${f.issueType}</span> (${f.voucherNumber})
              </div>
              <div class="${f.severity === 'Critical' ? 'text-red-700' : 'text-amber-700'} uppercase font-bold text-[10px]">
                ${f.severity} · ${formatInr(f.amount)}
              </div>
            </div>
            <div class="text-slate-600 mb-1"><strong>Reason:</strong> ${f.reason}</div>
            <div class="text-slate-500"><strong>Action:</strong> ${f.suggestedAction}</div>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="mt-8 pt-4 border-t border-slate-200 text-[11px] text-slate-400">
        Accounting AI Review Master Report · For professional audit and verification purposes only.
      </div>
    </div>
  `;
}
