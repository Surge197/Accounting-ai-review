import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { BatchReviewProgress, ClientCompany } from '../../clients/clientModel';

interface BatchReviewProgressModalProps {
  isOpen: boolean;
  progress: BatchReviewProgress | null;
  clients: ClientCompany[];
}

export const BatchReviewProgressModal: React.FC<BatchReviewProgressModalProps> = ({
  isOpen,
  progress,
  clients,
}) => {
  if (!isOpen || !progress) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Multi-Client Review In Progress</h3>
              <p className="text-xs text-slate-500">
                Processing {progress.currentClientIndex} of {progress.totalClients} client companies
              </p>
            </div>
          </div>
          <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            {progress.percentComplete}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Current: <strong className="text-slate-700">{progress.currentClientName}</strong></span>
            <span>Stage: <strong className="text-indigo-600">{progress.currentStage}</strong></span>
          </div>
        </div>

        {/* Client Checklist */}
        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto bg-slate-50/50">
          {clients
            .filter((c) => c.isSelected)
            .map((client) => {
              const isDone = client.reviewStatus === 'COMPLETED';
              const isWorking = client.reviewStatus === 'SYNCING' || client.reviewStatus === 'ANALYZING';
              const isFailed = client.reviewStatus === 'FAILED';

              return (
                <div
                  key={client.id}
                  className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors ${
                    isWorking ? 'bg-indigo-50/70' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{client.name}</span>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                      {client.software}
                    </span>
                    {client.dataSourceType === 'LIVE' && (
                      <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded font-semibold shrink-0">
                        LIVE
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {isDone && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Reviewed ({client.latestReport?.summary.transactionsAnalysed || client.transactions.length} tx)
                      </span>
                    )}
                    {isWorking && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {progress.currentStage}
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Failed
                      </span>
                    )}
                    {client.reviewStatus === 'IDLE' && (
                      <span className="text-[11px] text-slate-400">Queued</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {progress.logMessage && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-600 truncate">
            {progress.logMessage}
          </div>
        )}

        <div className="text-[11px] text-slate-400 text-center">
          Isolating client transactions and applying 18 accounting review checks independently...
        </div>
      </div>
    </div>
  );
};
