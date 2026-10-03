import React from 'react';
import { ReviewSummary, FindingSeverity } from '../normalizer/commonModel';
import { AlertOctagon, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface ResultsSummaryProps {
  summary: ReviewSummary;
  activeFilter: FindingSeverity | 'ALL';
  onFilterChange: (filter: FindingSeverity | 'ALL') => void;
}

export const ResultsSummary: React.FC<ResultsSummaryProps> = ({
  summary,
  activeFilter,
  onFilterChange,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Results Summary
        </h2>
        <span className="text-xs text-slate-500">
          Period: {summary.periodFrom} to {summary.periodTo}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Transactions Analysed */}
        <button
          type="button"
          onClick={() => onFilterChange('ALL')}
          className={`p-4 rounded-lg border text-left transition-all ${
            activeFilter === 'ALL'
              ? 'border-slate-900 bg-white ring-2 ring-slate-900 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Transactions Analysed</span>
            <CheckCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {summary.transactionsAnalysed}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {summary.software}
          </div>
        </button>

        {/* Metric 2: Critical issues */}
        <button
          type="button"
          onClick={() => onFilterChange('Critical')}
          className={`p-4 rounded-lg border text-left transition-all ${
            activeFilter === 'Critical'
              ? 'border-red-600 bg-red-50/50 ring-2 ring-red-600 shadow-xs'
              : 'border-red-200 bg-red-50/20 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between text-red-700 mb-1">
            <span className="text-xs font-medium">Critical Issues</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-700 tracking-tight">
            {summary.criticalIssues}
          </div>
          <div className="text-[11px] text-red-600/80 mt-1">
            Statutory & duplicate risks
          </div>
        </button>

        {/* Metric 3: Requires review */}
        <button
          type="button"
          onClick={() => onFilterChange('Requires review')}
          className={`p-4 rounded-lg border text-left transition-all ${
            activeFilter === 'Requires review'
              ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-600 shadow-xs'
              : 'border-amber-200 bg-amber-50/20 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-medium">Requires Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-800 tracking-tight">
            {summary.requiresReview}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-1">
            Outliers & tax variances
          </div>
        </button>

        {/* Metric 4: Observations */}
        <button
          type="button"
          onClick={() => onFilterChange('Observation')}
          className={`p-4 rounded-lg border text-left transition-all ${
            activeFilter === 'Observation'
              ? 'border-slate-800 bg-slate-100 ring-2 ring-slate-800 shadow-xs'
              : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-xs font-medium">Observations</span>
            <Info className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight">
            {summary.observations}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            Documentation & patterns
          </div>
        </button>
      </div>
    </div>
  );
};
