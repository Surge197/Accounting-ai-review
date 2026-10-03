import React from 'react';
import {
  Building2,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Info,
  ExternalLink,
  Zap,
  GitCompare,
  Terminal,
} from 'lucide-react';
import { ClientCompany, ConsolidatedPortfolioReport } from '../../clients/clientModel';
import { formatInr } from '../../rules/ruleEngine';
import { downloadExcelReport } from '../../reports/excelExporter';

interface ClientRiskMatrixTableProps {
  portfolio: ConsolidatedPortfolioReport;
  clients: ClientCompany[];
  onSelectClientForDetail: (clientId: string) => void;
  onOpenLogModal?: (client: ClientCompany) => void;
}

export const ClientRiskMatrixTable: React.FC<ClientRiskMatrixTableProps> = ({
  portfolio,
  clients,
  onSelectClientForDetail,
  onOpenLogModal,
}) => {
  const getClientById = (id: string) => clients.find((c) => c.id === id);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Client Risk & Audit Comparison Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Comparative multi-client risk ranking with data collection status and snapshot diff
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{portfolio.clientSummaries.length}</span> companies
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <th className="py-3 px-4">Client Company</th>
              <th className="py-3 px-3">Software & Source</th>
              <th className="py-3 px-3 text-center">Tx Count</th>
              <th className="py-3 px-3 text-center">Snapshot Diff</th>
              <th className="py-3 px-3 text-center">Critical</th>
              <th className="py-3 px-3 text-center">Review</th>
              <th className="py-3 px-3 text-center">Obs</th>
              <th className="py-3 px-3 text-right">Flagged Exposure</th>
              <th className="py-3 px-3 text-center">Risk Level</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {portfolio.clientSummaries.map((item) => {
              const fullClient = getClientById(item.clientId);
              const isReviewed = item.status === 'COMPLETED';

              return (
                <tr
                  key={item.clientId}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => onSelectClientForDetail(item.clientId)}
                >
                  {/* Company Name */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                          {item.clientName}
                        </div>
                        {fullClient && (
                          <div className="text-[11px] text-slate-500">
                            GSTIN: <span className="font-mono text-[10px]">{fullClient.gstin}</span> · {fullClient.industry}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Software & Source */}
                  <td className="py-3.5 px-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          item.software === 'TallyPrime'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {item.software}
                      </span>
                      {item.dataSourceType === 'LIVE' && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                          <Zap className="w-2.5 h-2.5" /> LIVE ✓
                        </span>
                      )}
                      {item.dataSourceType === 'FILE' && (
                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1 rounded">
                          FILE
                        </span>
                      )}
                      {item.dataSourceType === 'SAMPLE' && (
                        <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1 rounded">
                          BENCHMARK
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Transactions */}
                  <td className="py-3.5 px-3 text-center font-mono font-medium text-slate-700">
                    {item.transactionsCount}
                  </td>

                  {/* Snapshot Diff */}
                  <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-600">
                    <div className="flex items-center justify-center gap-1">
                      <GitCompare className="w-3 h-3 text-slate-400" />
                      <span>{item.snapshotDiffSummary || 'Baseline'}</span>
                    </div>
                  </td>

                  {/* Critical Issues */}
                  <td className="py-3.5 px-3 text-center">
                    {item.criticalCount > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold font-mono">
                        {item.criticalCount}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono">0</span>
                    )}
                  </td>

                  {/* Review Needed */}
                  <td className="py-3.5 px-3 text-center">
                    {item.reviewCount > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold font-mono">
                        {item.reviewCount}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono">0</span>
                    )}
                  </td>

                  {/* Observations */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="text-slate-600 font-mono">{item.observationCount}</span>
                  </td>

                  {/* Flagged Amount */}
                  <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900">
                    {item.flaggedAmount > 0 ? formatInr(item.flaggedAmount) : '—'}
                  </td>

                  {/* Risk Badge */}
                  <td className="py-3.5 px-3 text-center">
                    {item.riskScore === 'High Risk' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                        <ShieldAlert className="w-3 h-3" /> High Risk
                      </span>
                    )}
                    {item.riskScore === 'Medium Risk' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Medium Risk
                      </span>
                    )}
                    {item.riskScore === 'Low Risk' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        <Info className="w-3 h-3" /> Low Risk
                      </span>
                    )}
                    {item.riskScore === 'Clean' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Clean
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3.5 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {fullClient && onOpenLogModal && (
                        <button
                          onClick={() => onOpenLogModal(fullClient)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                          title="View Sync Log"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => onSelectClientForDetail(item.clientId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                        title="Open detailed single-client review view"
                      >
                        <span>View Report</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                      </button>

                      {fullClient?.latestReport && (
                        <button
                          onClick={() => downloadExcelReport(fullClient.latestReport!)}
                          className="inline-flex items-center p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-transparent hover:border-emerald-200 transition-colors"
                          title="Download client Excel report"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
