import React, { useState, useMemo } from 'react';
import {
  Building2,
  Play,
  Plus,
  Search,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Sparkles,
  ArrowUpRight,
  Trash2,
  Layers,
  Terminal,
  Server,
  Zap,
  RotateCcw,
  RefreshCw,
  GitCompare,
  Settings,
} from 'lucide-react';
import { ClientCompany, ConnectionStatus, DataSourceType } from '../../clients/clientModel';
import { AccountingSoftware } from '../../normalizer/commonModel';
import { formatInr } from '../../rules/ruleEngine';

interface ClientManagerSectionProps {
  clients: ClientCompany[];
  onToggleSelect: (clientId: string) => void;
  onToggleSelectAll: () => void;
  onRunSelectedReviews: (fullSync?: boolean) => void;
  onRetryFailed: () => void;
  isBatchRunning: boolean;
  onOpenAddModal: () => void;
  onOpenUploadModal: (client: ClientCompany) => void;
  onOpenConnectionModal: (client: ClientCompany) => void;
  onOpenLogModal: (client: ClientCompany) => void;
  onSelectClientForDetail: (clientId: string) => void;
  onDeleteClient: (clientId: string) => void;
  onTriggerSingleSync: (clientId: string, fullSync: boolean) => void;
  hasPortfolioResults: boolean;
  onJumpToPortfolioResults: () => void;
  onOpenApiSettings?: () => void;
}

export const ClientManagerSection: React.FC<ClientManagerSectionProps> = ({
  clients,
  onToggleSelect,
  onToggleSelectAll,
  onRunSelectedReviews,
  onRetryFailed,
  isBatchRunning,
  onOpenAddModal,
  onOpenUploadModal,
  onOpenConnectionModal,
  onOpenLogModal,
  onSelectClientForDetail,
  onDeleteClient,
  onTriggerSingleSync,
  hasPortfolioResults,
  onJumpToPortfolioResults,
  onOpenApiSettings,
}) => {
  const [softwareFilter, setSoftwareFilter] = useState<AccountingSoftware | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<DataSourceType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected & Failed counts
  const selectedCount = clients.filter((c) => c.isSelected).length;
  const failedCount = clients.filter((c) => c.reviewStatus === 'FAILED').length;
  const allSelected = clients.length > 0 && selectedCount === clients.length;

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (softwareFilter !== 'ALL' && c.software !== softwareFilter) return false;
      if (sourceFilter !== 'ALL' && c.dataSourceType !== sourceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          c.name.toLowerCase().includes(q) ||
          c.gstin.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [clients, softwareFilter, sourceFilter, searchQuery]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-4 p-5">
      {/* Top Banner: One-Click Multi-Client Review */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-900 p-5 rounded-xl text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">
              Control Center
            </span>
            <span className="text-xs text-slate-300">
              {clients.length} accounting client companies ({selectedCount} selected)
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            One-Click Multi-Client Accounting Review
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Automatically collect live accounting ledgers from TallyPrime and Zoho Books, normalize data into the unified model, compute transaction snapshots, and apply the 18 deterministic audit checks with strict client isolation.
          </p>
        </div>

        {/* Action Buttons: RUN SELECTED CLIENT REVIEWS & RETRY FAILED */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenApiSettings && (
            <button
              onClick={onOpenApiSettings}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
              title="Open API Integration Settings for OpenAI, Zoho Books, and TallyPrime"
            >
              <Settings className="w-4 h-4 text-amber-300" />
              <span>API Settings</span>
            </button>
          )}

          {hasPortfolioResults && (
            <button
              onClick={onJumpToPortfolioResults}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              <Layers className="w-4 h-4 text-indigo-300" />
              <span>View Results</span>
            </button>
          )}

          {failedCount > 0 && (
            <button
              onClick={onRetryFailed}
              disabled={isBatchRunning}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-red-400/40 bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold text-red-200 transition-colors"
              title="Re-run reviews only for failed clients"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RETRY FAILED ({failedCount})</span>
            </button>
          )}

          <div className="inline-flex rounded-lg shadow-md">
            <button
              onClick={() => onRunSelectedReviews(false)}
              disabled={isBatchRunning || selectedCount === 0}
              type="button"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-l-lg font-bold text-xs uppercase tracking-wider text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all active:scale-98"
              title="Collect accounting data, create snapshots, and run 18 rules for selected clients"
            >
              <Play className={`w-4 h-4 fill-current ${isBatchRunning ? 'animate-spin' : ''}`} />
              <span>
                {isBatchRunning ? 'Running Reviews...' : `RUN SELECTED CLIENT REVIEWS (${selectedCount})`}
              </span>
            </button>

            <button
              onClick={() => onRunSelectedReviews(true)}
              disabled={isBatchRunning || selectedCount === 0}
              type="button"
              className="px-2.5 py-3 rounded-r-lg font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-amber-500 hover:bg-amber-400 border-l border-amber-600 disabled:bg-slate-800 disabled:text-slate-500 transition-all"
              title="Force full synchronization for all selected clients"
            >
              Full Sync
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Select all toggle */}
          <button
            onClick={onToggleSelectAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="font-medium">
              {allSelected ? 'Deselect All' : 'Select All'} ({selectedCount}/{clients.length})
            </span>
          </button>

          {/* Software Filter */}
          <select
            value={softwareFilter}
            onChange={(e) => setSoftwareFilter(e.target.value as any)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Software (Tally & Zoho)</option>
            <option value="TallyPrime">TallyPrime</option>
            <option value="Zoho Books">Zoho Books</option>
          </select>

          {/* Data Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Data Sources</option>
            <option value="LIVE">Live API/ODBC Only</option>
            <option value="FILE">File Import Only</option>
          </select>
        </div>

        {/* Search & Add Client Button */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search client or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-md text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56"
            />
          </div>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors shadow-2xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Clients Table */}
      <div className="border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <th className="py-2.5 px-3 w-10 text-center"></th>
              <th className="py-2.5 px-3">Client Company</th>
              <th className="py-2.5 px-3">Software & Source</th>
              <th className="py-2.5 px-3">Connection Status</th>
              <th className="py-2.5 px-3 text-center">Transactions</th>
              <th className="py-2.5 px-3">Snapshot Diff</th>
              <th className="py-2.5 px-3">Latest Audit Review</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredClients.map((client) => {
              const isReviewed = client.reviewStatus === 'COMPLETED' && !!client.latestReport;
              const hasCritical = (client.latestReport?.summary.criticalIssues || 0) > 0;
              const snapshotDiff = client.currentSnapshot?.diffFromPrevious;

              return (
                <tr
                  key={client.id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    client.isSelected ? 'bg-indigo-50/15' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-3 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={client.isSelected}
                      onChange={() => onToggleSelect(client.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                    />
                  </td>

                  {/* Company Name & GSTIN */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{client.name}</div>
                        <div className="text-[11px] text-slate-500">
                          GSTIN: <span className="font-mono text-[10px]">{client.gstin}</span> · {client.industry}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Software & Data Source Badge */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          client.software === 'TallyPrime'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {client.software}
                      </span>

                      {/* Source badge: LIVE vs FILE vs SAMPLE */}
                      {client.dataSourceType === 'LIVE' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          <Zap className="w-2.5 h-2.5 text-emerald-600" /> LIVE ✓
                        </span>
                      )}
                      {client.dataSourceType === 'FILE' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          <FileSpreadsheet className="w-2.5 h-2.5 text-slate-500" /> FILE
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Connection Status */}
                  <td className="py-3 px-3">
                    {client.connectionStatus === 'CONNECTED' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Connected</span>
                      </span>
                    )}
                    {client.connectionStatus === 'FILE_LOADED' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                        <span>File Loaded</span>
                      </span>
                    )}
                    {client.connectionStatus === 'SYNC_PENDING' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700" title={client.errorMessage}>
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Sync Pending</span>
                      </span>
                    )}
                    {client.connectionStatus === 'SYNC_FAILED' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700" title={client.errorMessage}>
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>Sync Failed</span>
                      </span>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]" title={client.activeFileName || client.connectionEndpoint}>
                      {client.activeFileName || client.connectionEndpoint || client.organizationId}
                    </div>
                  </td>

                  {/* Transactions Count */}
                  <td className="py-3 px-3 text-center">
                    <span className="font-mono font-medium text-slate-800">
                      {client.transactions.length}
                    </span>
                  </td>

                  {/* Snapshot Diff */}
                  <td className="py-3 px-3">
                    {snapshotDiff ? (
                      <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                        <GitCompare className="w-3 h-3 text-slate-400" />
                        <span>+{snapshotDiff.addedCount} / ~{snapshotDiff.modifiedCount} / -{snapshotDiff.deletedCount}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">Baseline</span>
                    )}
                  </td>

                  {/* Latest Review Status */}
                  <td className="py-3 px-3">
                    {client.reviewStatus === 'FAILED' ? (
                      <div className="text-red-700 font-bold text-[11px] flex items-center gap-1" title={client.errorMessage}>
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="truncate max-w-[130px]">{client.errorMessage || 'Review failed'}</span>
                      </div>
                    ) : isReviewed ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="font-semibold text-slate-800">
                            {client.latestReport?.summary.transactionsAnalysed} tx
                          </span>
                          <span className="text-slate-400">·</span>
                          {hasCritical ? (
                            <span className="text-red-700 font-bold">
                              {client.latestReport?.summary.criticalIssues} critical
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium">Clean</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {client.lastReviewedAt
                            ? new Date(client.lastReviewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Reviewed'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Not reviewed yet</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Connection Settings */}
                      <button
                        onClick={() => onOpenConnectionModal(client)}
                        className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Configure Live Connection & Credentials"
                      >
                        <Server className="w-3.5 h-3.5" />
                      </button>

                      {/* Sync Log */}
                      <button
                        onClick={() => onOpenLogModal(client)}
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                        title="View Technical Data Pull Log"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                      </button>

                      {/* Upload Data */}
                      <button
                        onClick={() => onOpenUploadModal(client)}
                        className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Upload file (XML/CSV/Excel/JSON)"
                      >
                        <UploadCloud className="w-3 h-3 text-slate-500" />
                        <span className="hidden sm:inline">Data</span>
                      </button>

                      {/* Single Review */}
                      <button
                        onClick={() => onSelectClientForDetail(client.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-indigo-200 text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-colors"
                        title="View detailed client report"
                      >
                        <span>Review</span>
                        <ArrowUpRight className="w-3 h-3 text-indigo-500" />
                      </button>

                      {clients.length > 2 && (
                        <button
                          onClick={() => onDeleteClient(client.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Remove client"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
