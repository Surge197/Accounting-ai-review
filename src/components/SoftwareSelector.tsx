import React from 'react';
import { AccountingSoftware } from '../normalizer/commonModel';
import { Database, Layers } from 'lucide-react';

interface SoftwareSelectorProps {
  selectedSoftware: AccountingSoftware;
  onSelect: (software: AccountingSoftware) => void;
}

export const SoftwareSelector: React.FC<SoftwareSelectorProps> = ({ selectedSoftware, onSelect }) => {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
        Accounting Software
      </label>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <button
          type="button"
          onClick={() => onSelect('TallyPrime')}
          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
            selectedSoftware === 'TallyPrime'
              ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Database className={`w-5 h-5 shrink-0 ${selectedSoftware === 'TallyPrime' ? 'text-white' : 'text-slate-500'}`} />
          <div>
            <div className="text-sm font-semibold">TallyPrime</div>
            <div className={`text-[11px] ${selectedSoftware === 'TallyPrime' ? 'text-slate-300' : 'text-slate-500'}`}>
              XML, DayBook, Excel, CSV
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('Zoho Books')}
          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
            selectedSoftware === 'Zoho Books'
              ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Layers className={`w-5 h-5 shrink-0 ${selectedSoftware === 'Zoho Books' ? 'text-white' : 'text-slate-500'}`} />
          <div>
            <div className="text-sm font-semibold">Zoho Books</div>
            <div className={`text-[11px] ${selectedSoftware === 'Zoho Books' ? 'text-slate-300' : 'text-slate-500'}`}>
              Invoices, Bills, Excel, CSV
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
