import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Search,
  Building2,
  Sparkles,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { ConsolidatedPortfolioReport, ClientCompany } from '../../clients/clientModel';
import { FindingSeverity, AccountingSoftware } from '../../normalizer/commonModel';
import { formatInr } from '../../rules/ruleEngine';

interface ConsolidatedFindingsSectionProps {
  portfolio: ConsolidatedPortfolioReport;
  clients: ClientCompany[];
  activeSeverityFilter: FindingSeverity | 'ALL';
  onSeverityFilterChange: (severity: FindingSeverity | 'ALL') => void;
  onSelectClientForDetail: (clientId: string) => void;
}

export const ConsolidatedFindingsSection: React.FC<ConsolidatedFindingsSectionProps> = ({
  portfolio,
  clients,
  activeSeverityFilter,
  onSeverityFilterChange,
  onSelectClientForDetail,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [selectedSoftware, setSelectedSoftware] = useState<AccountingSoftware | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIssueType, setSelectedIssueType] = useState<string>('ALL');

  // Extract unique issue types
  const issueTypes = useMemo(() => {
    const set = new Set<string>();
    portfolio.allFindings.forEach((f) => set.add(f.issueType));
    return Array.from(set).sort();
  }, [portfolio.allFindings]);

  // Filtered findings list
  const filteredFindings = useMemo(() => {
    return portfolio.allFindings.filter((f) => {
      // Severity filter
      if (activeSeverityFilter !== 'ALL' && f.severity !== activeSeverityFilter) {
        return false;
      }
      // Client filter
      if (selectedClientId !== 'ALL' && f.clientId !== selectedClientId) {
        return false;
      }
      // Software filter
      if (selectedSoftware !== 'ALL' && f.software !== selectedSoftware) {
        return false;
      }
      // Issue type filter
      if (selectedIssueType !== 'ALL' && f.issueType !== selectedIssueType) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          f.clientName.toLowerCase().includes(q) ||
          f.party.toLowerCase().includes(q) ||
          f.voucherNumber.toLowerCase().includes(q) ||
          f.issueType.toLowerCase().includes(q) ||
          f.explanation.toLowerCase().includes(q) ||
          f.reason.toLowerCase().includes(q) ||
          (f.aiExplanation && f.aiExplanation.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [
    portfolio.allFindings,
    activeSeverityFilter,
    selectedClientId,
    selectedSoftware,
    selectedIssueType,
    searchQuery,
  ]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-4 p-5">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            Consolidated Findings ({filteredFindings.length} of {portfolio.allFindings.length})
          </h3>
          <p className="text-xs text-slate-500">
            Unified cross-client audit observations flagged across all active client ledgers
          </p>
        </div>

        {/* Quick Severity Filter Tabs */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => onSeverityFilterChange('ALL')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeSeverityFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({portfolio.allFindings.length})
          </button>
          <button
            onClick={() => onSeverityFilterChange('Critical')}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              activeSeverityFilter === 'Critical'
                ? 'bg-red-50 text-red-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-red-700'
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-red-600" />
            Critical ({portfolio.criticalIssues})
          </button>
          <button
            onClick={() => onSeverityFilterChange('Requires review')}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              activeSeverityFilter === 'Requires review'
                ? 'bg-amber-50 text-amber-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Review ({portfolio.requiresReview})
          </button>
          <button
            onClick={() => onSeverityFilterChange('Observation')}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              activeSeverityFilter === 'Observation'
                ? 'bg-slate-200 text-slate-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Info className="w-3 h-3 text-slate-500" />
            Obs ({portfolio.observations})
          </button>
        </div>
      </div>

      {/* Multi-Facet Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search party, voucher, narrative..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800"
          />
        </div>

        {/* Client Filter */}
        <div>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800"
          >
            <option value="ALL">All Clients ({clients.length})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.software})
              </option>
            ))}
          </select>
        </div>

        {/* Software Filter */}
        <div>
          <select
            value={selectedSoftware}
            onChange={(e) => setSelectedSoftware(e.target.value as any)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800"
          >
            <option value="ALL">All Software (Tally & Zoho)</option>
            <option value="TallyPrime">TallyPrime Only</option>
            <option value="Zoho Books">Zoho Books Only</option>
          </select>
        </div>

        {/* Issue Type Filter */}
        <div>
          <select
            value={selectedIssueType}
            onChange={(e) => setSelectedIssueType(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800"
          >
            <option value="ALL">All Issue Types ({issueTypes.length})</option>
            {issueTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Findings Cards List */}
      {filteredFindings.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl">
          No findings match the selected filters or search query.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding) => {
            const isCritical = finding.severity === 'Critical';
            const isReview = finding.severity === 'Requires review';

            return (
              <div
                key={`${finding.clientId}-${finding.id}`}
                className={`border rounded-xl p-4 transition-all text-xs space-y-3 bg-white ${
                  isCritical
                    ? 'border-red-200 hover:border-red-300 shadow-2xs'
                    : isReview
                    ? 'border-amber-200 hover:border-amber-300 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Severity Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        isCritical
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : isReview
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {isCritical && <ShieldAlert className="w-3 h-3 text-red-600" />}
                      {isReview && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                      {!isCritical && !isReview && <Info className="w-3 h-3 text-slate-500" />}
                      {finding.severity}
                    </span>

                    {/* Client Badge */}
                    <button
                      onClick={() => onSelectClientForDetail(finding.clientId)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
                      title="View client details"
                    >
                      <Building2 className="w-3 h-3 text-slate-500" />
                      <span>{finding.clientName}</span>
                    </button>

                    {/* Software Pill */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        finding.software === 'TallyPrime'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {finding.software}
                    </span>

                    {/* Issue Type */}
                    <span className="font-semibold text-slate-900">{finding.issueType}</span>
                  </div>

                  {/* Amount & Date */}
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-slate-500 font-mono text-[11px]">{finding.date}</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {formatInr(finding.amount)}
                    </span>
                    <button
                      onClick={() => onSelectClientForDetail(finding.clientId)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                      title="Drill down to client report"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Voucher & Party */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400">Voucher / Invoice:</span>{' '}
                    <span className="font-mono font-medium text-slate-800">
                      {finding.voucherNumber || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Counterparty / Ledger:</span>{' '}
                    <span className="font-medium text-slate-800">{finding.party || '—'}</span>
                  </div>
                </div>

                {/* Explanation & Reason */}
                <div className="space-y-1.5 leading-relaxed text-slate-700">
                  <div>
                    <strong className="text-slate-900">Explanation:</strong> {finding.explanation}
                  </div>
                  <div>
                    <strong className="text-slate-900">Reason for Flagging:</strong> {finding.reason}
                  </div>
                </div>

                {/* AI Explanation */}
                {finding.aiExplanation && (
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-indigo-950 leading-relaxed space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Audit Analysis
                    </div>
                    <p className="text-xs text-indigo-900/90">{finding.aiExplanation}</p>
                  </div>
                )}

                {/* Suggested Action */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-slate-700 leading-relaxed text-[11px]">
                  <strong className="text-slate-900 font-semibold">
                    Suggested Verification / Action:
                  </strong>{' '}
                  {finding.suggestedAction}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
