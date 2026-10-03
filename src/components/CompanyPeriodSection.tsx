import React from 'react';
import { Building2, Calendar } from 'lucide-react';

interface CompanyPeriodProps {
  companyName: string;
  onCompanyChange: (name: string) => void;
  periodFrom: string;
  onPeriodFromChange: (date: string) => void;
  periodTo: string;
  onPeriodToChange: (date: string) => void;
}

export const CompanyPeriodSection: React.FC<CompanyPeriodProps> = ({
  companyName,
  onCompanyChange,
  periodFrom,
  onPeriodFromChange,
  periodTo,
  onPeriodToChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-1">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Company Name
        </label>
        <div className="relative">
          <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={companyName}
            onChange={(e) => onCompanyChange(e.target.value)}
            placeholder="e.g. Zenith Engineering Pvt Ltd"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Period: From Date
        </label>
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="date"
            value={periodFrom}
            onChange={(e) => onPeriodFromChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Period: To Date
        </label>
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="date"
            value={periodTo}
            onChange={(e) => onPeriodToChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};
