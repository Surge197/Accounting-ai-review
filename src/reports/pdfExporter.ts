import { ReviewReport } from '../normalizer/commonModel';
import { formatInr } from '../rules/ruleEngine';

export function printOrDownloadPdfReport(report: ReviewReport) {
  // Use browser's native print engine with professional print styling
  window.print();
}

export function generateReportHtml(report: ReviewReport): string {
  const { summary, findings } = report;

  return `
    <div class="accounting-print-report font-sans text-slate-900 bg-white p-8 max-w-4xl mx-auto">
      <div class="border-b-2 border-slate-900 pb-4 mb-6">
        <h1 class="text-2xl font-bold uppercase tracking-wider text-slate-900">Accounting AI Review Report</h1>
        <p class="text-xs text-slate-500 mt-1">Generated: ${new Date(summary.runTimestamp).toLocaleString()}</p>
      </div>

      <div class="grid grid-cols-2 gap-4 text-sm mb-6 border-b border-slate-200 pb-4">
        <div>
          <span class="text-slate-500 font-medium">Company:</span>
          <span class="font-semibold ml-2">${summary.company}</span>
        </div>
        <div>
          <span class="text-slate-500 font-medium">Software:</span>
          <span class="font-semibold ml-2">${summary.software}</span>
        </div>
        <div>
          <span class="text-slate-500 font-medium">Review Period:</span>
          <span class="font-semibold ml-2">${summary.periodFrom} to ${summary.periodTo}</span>
        </div>
        <div>
          <span class="text-slate-500 font-medium">Transactions Analysed:</span>
          <span class="font-semibold ml-2">${summary.transactionsAnalysed}</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 text-center mb-8">
        <div class="p-3 border border-red-200 bg-red-50 rounded">
          <div class="text-xs font-semibold text-red-700 uppercase">Critical</div>
          <div class="text-xl font-bold text-red-800 mt-0.5">${summary.criticalIssues}</div>
        </div>
        <div class="p-3 border border-amber-200 bg-amber-50 rounded">
          <div class="text-xs font-semibold text-amber-700 uppercase">Requires Review</div>
          <div class="text-xl font-bold text-amber-800 mt-0.5">${summary.requiresReview}</div>
        </div>
        <div class="p-3 border border-slate-200 bg-slate-50 rounded">
          <div class="text-xs font-semibold text-slate-700 uppercase">Observations</div>
          <div class="text-xl font-bold text-slate-800 mt-0.5">${summary.observations}</div>
        </div>
      </div>

      <h2 class="text-base font-bold uppercase tracking-wide text-slate-900 mb-4">Findings (${findings.length})</h2>

      <div class="space-y-4">
        ${findings
          .map(
            (f, idx) => `
          <div class="border border-slate-200 p-4 rounded text-xs leading-relaxed page-break-inside-avoid">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-sm text-slate-900">${idx + 1}. ${f.issueType}</span>
              <span class="font-semibold uppercase px-2 py-0.5 rounded text-[11px] ${
                f.severity === 'Critical'
                  ? 'bg-red-100 text-red-800'
                  : f.severity === 'Requires review'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-800'
              }">${f.severity}</span>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-slate-700 mb-2">
              <div><span class="text-slate-500">Transaction Date:</span> ${f.date}</div>
              <div><span class="text-slate-500">Voucher / Invoice #:</span> ${f.voucherNumber}</div>
              <div><span class="text-slate-500">Party:</span> ${f.party}</div>
              <div><span class="text-slate-500">Amount:</span> ${formatInr(f.amount)}</div>
            </div>

            <div class="mb-2">
              <span class="font-semibold text-slate-900">Reason for Flagging:</span>
              <p class="text-slate-600 mt-0.5">${f.reason}</p>
            </div>

            ${
              f.aiExplanation
                ? `
            <div class="mb-2 bg-slate-50 p-2.5 rounded border border-slate-200">
              <span class="font-semibold text-slate-900">AI Explanation:</span>
              <p class="text-slate-700 mt-0.5 italic">"${f.aiExplanation}"</p>
            </div>
            `
                : ''
            }

            <div>
              <span class="font-semibold text-slate-900">Suggested Verification:</span>
              <p class="text-slate-700 mt-0.5">${f.suggestedAction}</p>
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="mt-8 pt-4 border-t border-slate-300 text-center text-xs text-slate-500 italic">
        "AI-generated analysis is for accounting review assistance only. Final verification must be performed by an authorized accounting professional."
      </div>
    </div>
  `;
}
