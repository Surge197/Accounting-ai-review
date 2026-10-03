import React from 'react';
import { ReviewFinding, FindingSeverity } from '../normalizer/commonModel';
import { formatInr } from '../rules/ruleEngine';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Building2,
  Calendar,
  Receipt,
  User,
  IndianRupee,
  Sparkles,
  CheckCheck,
  Search,
} from 'lucide-react';

interface FindingsListProps {
  findings: ReviewFinding[];
  activeFilter: FindingSeverity | 'ALL';
  onFilterChange: (filter: FindingSeverity | 'ALL') => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  activeFilter,
  onFilterChange,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredFindings = findings.filter((f) => {
    if (activeFilter !== 'ALL' && f.severity !== activeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        f.issueType.toLowerCase().includes(q) ||
        f.party.toLowerCase().includes(q) ||
        f.voucherNumber.toLowerCase().includes(q) ||
        f.reason.toLowerCase().includes(q) ||
        f.company.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Findings List ({filteredFindings.length})
          </h2>
          <p className="text-xs text-slate-500">
            Rule engine & AI verified anomalies requiring auditor confirmation
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search party, voucher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-md bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-800"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-xs">
            {(['ALL', 'Critical', 'Requires review', 'Observation'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onFilterChange(filter)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeFilter === filter
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredFindings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
          No findings matching the selected filter or query.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding, index) => {
            const isCritical = finding.severity === 'Critical';
            const isReview = finding.severity === 'Requires review';

            return (
              <div
                key={finding.id || index}
                className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-xs transition-colors hover:border-slate-300"
              >
                {/* Header: Finding Title + Severity */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-start sm:items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-400 mt-0.5 sm:mt-0">
                      #{index + 1}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {finding.issueType}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold ${
                        isCritical
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : isReview
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {isCritical ? (
                        <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
                      ) : isReview ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-slate-600" />
                      )}
                      <span>{finding.severity}</span>
                    </span>
                  </div>
                </div>

                {/* Structured Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3 text-xs bg-slate-50/70 -mx-4 sm:-mx-5 px-4 sm:px-5 my-2 border-y border-slate-100">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Company</span>
                    <span className="text-slate-800 font-medium truncate block" title={finding.company}>
                      {finding.company}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Date</span>
                    <span className="text-slate-800 font-medium">{finding.date}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Voucher / Invoice</span>
                    <span className="text-slate-800 font-mono font-medium">{finding.voucherNumber}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Party</span>
                    <span className="text-slate-800 font-medium truncate block" title={finding.party}>
                      {finding.party}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Amount</span>
                    <span className="text-slate-900 font-bold font-mono text-sm">
                      {formatInr(finding.amount)}
                    </span>
                  </div>
                </div>

                {/* Explanation */}
                <div className="text-xs text-slate-700 mt-2 mb-2 leading-relaxed">
                  <span className="font-semibold text-slate-900">Explanation: </span>
                  <span>{finding.explanation}</span>
                </div>

                {/* Reason for Flagging */}
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 mt-2">
                  <span className="font-semibold text-slate-900">Reason for Flagging: </span>
                  <span>{finding.reason}</span>
                </div>

                {/* AI Explanation */}
                {finding.aiExplanation && (
                  <div className="text-xs text-slate-800 bg-slate-100/90 p-2.5 rounded border border-slate-300 mt-2 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900">AI Pattern Analysis: </span>
                      <span className="italic">{finding.aiExplanation}</span>
                    </div>
                  </div>
                )}

                {/* Suggested Verification / Action */}
                <div className="text-xs text-slate-700 mt-3 pt-2.5 border-t border-slate-100 flex items-start gap-1.5">
                  <CheckCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">Suggested Verification / Action: </span>
                    <span className="text-slate-700">{finding.suggestedAction}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mandatory Regulatory & Professional Disclaimer */}
      <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-center text-xs text-slate-600 italic">
        "AI-generated analysis is for accounting review assistance only. Final verification must be performed by an authorized accounting professional."
      </div>
    </div>
  );
};
