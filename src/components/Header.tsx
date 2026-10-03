import React from 'react';
import { ShieldCheck, FileSpreadsheet, Users, UserCheck, Settings } from 'lucide-react';

interface HeaderProps {
  onLoadSample: () => void;
  hasData: boolean;
  viewMode: 'multi_client' | 'single_client';
  onViewModeChange: (mode: 'multi_client' | 'single_client') => void;
  clientCount: number;
  onOpenApiSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadSample,
  hasData,
  viewMode,
  onViewModeChange,
  clientCount,
  onOpenApiSettings,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
            AR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Accounting AI Review
              </h1>
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                Multi-Client Platform
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Standardized review assistant for TallyPrime & Zoho Books
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            onClick={() => onViewModeChange('multi_client')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              viewMode === 'multi_client'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Multi-Client</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-mono">
              {clientCount}
            </span>
          </button>

          <button
            onClick={() => onViewModeChange('single_client')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              viewMode === 'single_client'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Single Client (MVP)</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenApiSettings && (
            <button
              onClick={onOpenApiSettings}
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
              title="Configure OpenAI, Zoho Books, and TallyPrime API integrations"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">API Settings</span>
            </button>
          )}

          <button
            onClick={onLoadSample}
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
            title="Reset to default multi-client benchmark audit dataset"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Reset Data</span>
          </button>

          <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Read-Only Reviewer</span>
          </div>
        </div>
      </div>
    </header>
  );
};
