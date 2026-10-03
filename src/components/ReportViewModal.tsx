import React from 'react';
import { ReviewReport } from '../normalizer/commonModel';
import { formatInr } from '../rules/ruleEngine';
import { downloadExcelReport } from '../reports/excelExporter';
import { printOrDownloadPdfReport } from '../reports/pdfExporter';
import { X, Printer, FileSpreadsheet } from 'lucide-react';

interface ReportViewModalProps {
  report: ReviewReport;
  onClose: () => void;
}

export const ReportViewModal: React.FC<ReportViewModalProps> = ({ report, onClose }) => {
  const { summary, findings } = report;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] flex flex-col border border-slate-200">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">Accounting Review Report Document</span>
            <span className="text-xs text-slate-500">· {summary.company}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadExcelReport(report)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => printOrDownloadPdfReport(report)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content: Format matches user specifications exactly */}
        <div className="p-8 overflow-y-auto font-mono text-xs space-y-6 select-text">
          <div className="text-center border-b border-slate-300 pb-4">
            <h1 className="text-lg font-bold uppercase tracking-widest text-slate-900">
              ACCOUNTING REVIEW REPORT
            </h1>
            <p className="text-[11px] text-slate-500 mt-1">
              Statutory and Rule-Based Audit Verification
            </p>
          </div>

          {/* Header Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-4 rounded border border-slate-200 text-slate-800">
            <div>
              <span className="font-bold text-slate-900">Company: </span>
              <span>{summary.company}</span>
            </div>
            <div>
              <span className="font-bold text-slate-900">Software: </span>
              <span>{summary.software}</span>
            </div>
            <div>
              <span className="font-bold text-slate-900">Period: </span>
              <span>{summary.periodFrom} to {summary.periodTo}</span>
            </div>
            <div>
              <span className="font-bold text-slate-900">Run Timestamp: </span>
              <span>{new Date(summary.runTimestamp).toLocaleString()}</span>
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="border border-slate-300 rounded p-4 bg-white">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-2 border border-slate-200 rounded">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Transactions analysed</div>
                <div className="text-base font-bold text-slate-900 mt-1">{summary.transactionsAnalysed}</div>
              </div>
              <div className="p-2 border border-red-200 bg-red-50/50 rounded">
                <div className="text-[10px] text-red-700 uppercase font-bold">Critical</div>
                <div className="text-base font-bold text-red-700 mt-1">{summary.criticalIssues}</div>
              </div>
              <div className="p-2 border border-amber-200 bg-amber-50/50 rounded">
                <div className="text-[10px] text-amber-700 uppercase font-bold">Requires Review</div>
                <div className="text-base font-bold text-amber-700 mt-1">{summary.requiresReview}</div>
              </div>
              <div className="p-2 border border-slate-200 bg-slate-50 rounded">
                <div className="text-[10px] text-slate-600 uppercase font-bold">Observations</div>
                <div className="text-base font-bold text-slate-800 mt-1">{summary.observations}</div>
              </div>
            </div>
          </div>

          {/* FINDINGS LIST */}
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-2 mb-4">
              FINDINGS ({findings.length})
            </div>

            <div className="space-y-4">
              {findings.map((f, idx) => (
                <div
                  key={f.id || idx}
                  className="p-4 border border-slate-300 rounded bg-white space-y-2 text-slate-800"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="font-bold text-slate-900 text-xs">
                      {idx + 1}. {f.issueType}
                    </span>
                    <span className="font-bold px-2 py-0.5 rounded text-[10px] border border-slate-300">
                      Severity: {f.severity}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-1 text-slate-700">
                    <div>
                      <span className="font-semibold text-slate-900">Transaction: </span>
                      <span>{f.voucherNumber} ({f.date})</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Party: </span>
                      <span>{f.party}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Amount: </span>
                      <span className="font-bold text-slate-900">{formatInr(f.amount)}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Company: </span>
                      <span>{f.company}</span>
                    </div>
                  </div>

                  <div className="text-[11px] pt-1">
                    <span className="font-semibold text-slate-900">Reason: </span>
                    <span>{f.reason}</span>
                  </div>

                  {f.aiExplanation && (
                    <div className="text-[11px] p-2 bg-slate-50 border border-slate-200 rounded text-slate-900">
                      <span className="font-semibold">AI Explanation: </span>
                      <span className="italic">{f.aiExplanation}</span>
                    </div>
                  )}

                  <div className="text-[11px]">
                    <span className="font-semibold text-slate-900">Suggested Verification: </span>
                    <span className="text-slate-800">{f.suggestedAction}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Mandatory Clause */}
          <div className="border-t border-slate-300 pt-4 text-center text-[11px] text-slate-600 italic">
            "AI-generated analysis is for accounting review assistance only. Final verification must be performed by an authorized accounting professional."
          </div>
        </div>
      </div>
    </div>
  );
};
