import React from 'react';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, DollarSign, Layers } from 'lucide-react';
import { ConsolidatedPortfolioReport } from '../../clients/clientModel';
import { FindingSeverity } from '../../normalizer/commonModel';
import { formatInr } from '../../rules/ruleEngine';

interface ConsolidatedSummaryCardsProps {
  portfolio: ConsolidatedPortfolioReport;
  activeFilter: FindingSeverity | 'ALL';
  onFilterChange: (filter: FindingSeverity | 'ALL') => void;
}

export const ConsolidatedSummaryCards: React.FC<ConsolidatedSummaryCardsProps> = ({
  portfolio,
  activeFilter,
  onFilterChange,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          Consolidated Portfolio Audit Results
        </h3>
        <span className="text-xs text-slate-500">
          Last batch run: {new Date(portfolio.runTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Clients */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Clients Reviewed
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {portfolio.totalClientsReviewed}
            <span className="text-sm font-normal text-slate-400 ml-1">/ {portfolio.totalClients}</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Active Multi-Client
          </div>
        </div>

        {/* Transactions Analysed */}
        <div
          onClick={() => onFilterChange('ALL')}
          className={`cursor-pointer transition-all bg-white border rounded-xl p-3.5 shadow-2xs hover:border-slate-400 ${
            activeFilter === 'ALL' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Transactions
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {portfolio.totalTransactions.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Click to view all findings
          </div>
        </div>

        {/* Critical Issues */}
        <div
          onClick={() => onFilterChange('Critical')}
          className={`cursor-pointer transition-all bg-white border rounded-xl p-3.5 shadow-2xs hover:border-red-400 ${
            activeFilter === 'Critical'
              ? 'ring-2 ring-red-500 border-red-500 bg-red-50/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">
              Critical
            </span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-red-700">
            {portfolio.criticalIssues}
          </div>
          <div className="text-[11px] text-red-600/80 font-medium mt-0.5">
            Immediate action
          </div>
        </div>

        {/* Requires Review */}
        <div
          onClick={() => onFilterChange('Requires review')}
          className={`cursor-pointer transition-all bg-white border rounded-xl p-3.5 shadow-2xs hover:border-amber-400 ${
            activeFilter === 'Requires review'
              ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
              Review Needed
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-700">
            {portfolio.requiresReview}
          </div>
          <div className="text-[11px] text-amber-600/80 font-medium mt-0.5">
            Voucher verification
          </div>
        </div>

        {/* Observations */}
        <div
          onClick={() => onFilterChange('Observation')}
          className={`cursor-pointer transition-all bg-white border rounded-xl p-3.5 shadow-2xs hover:border-slate-400 ${
            activeFilter === 'Observation'
              ? 'ring-2 ring-slate-600 border-slate-600 bg-slate-50/60'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
              Observations
            </span>
            <Info className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-800">
            {portfolio.observations}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Patterns & notes
          </div>
        </div>

        {/* Total Flagged Amount */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Flagged Exposure
            </span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900 truncate" title={formatInr(portfolio.totalFlaggedAmount)}>
            {formatInr(portfolio.totalFlaggedAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Cumulative portfolio
          </div>
        </div>
      </div>
    </div>
  );
};
