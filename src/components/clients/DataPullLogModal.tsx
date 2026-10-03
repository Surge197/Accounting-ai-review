import React from 'react';
import { X, Terminal, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { ClientCompany } from '../../clients/clientModel';

interface DataPullLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientCompany | null;
}

export const DataPullLogModal: React.FC<DataPullLogModalProps> = ({
  isOpen,
  onClose,
  client,
}) => {
  if (!isOpen || !client) return null;

  const logs = client.syncLogs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Data Pull & Sync Log</h3>
              <p className="text-xs text-slate-400">
                {client.name} · {client.software} ({client.dataSourceType})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snapshot Summary Badge */}
        {client.currentSnapshot && (
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400">Current Snapshot:</span>{' '}
              <strong className="text-white font-mono">{client.currentSnapshot.id}</strong>
            </div>
            <div className="text-[11px] font-mono text-indigo-300">
              {client.currentSnapshot.diffFromPrevious
                ? `Diff: +${client.currentSnapshot.diffFromPrevious.addedCount} Added / ~${client.currentSnapshot.diffFromPrevious.modifiedCount} Modified / -${client.currentSnapshot.diffFromPrevious.deletedCount} Deleted`
                : 'Baseline Snapshot'}
            </div>
          </div>
        )}

        {/* Console Log Area */}
        <div className="bg-black/60 rounded-xl p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-2 border border-slate-800">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center py-4">No sync logs recorded yet for this client.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-500 text-[11px] shrink-0 select-none">
                  [{log.timestamp}]
                </span>
                <span className="shrink-0 mt-0.5">
                  {log.level === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {log.level === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                  {log.level === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  {log.level === 'info' && <Info className="w-3.5 h-3.5 text-indigo-400" />}
                </span>
                <span
                  className={
                    log.level === 'success'
                      ? 'text-emerald-300'
                      : log.level === 'error'
                      ? 'text-red-300'
                      : log.level === 'warn'
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
          <span>Read-Only Integration · No ledger modification or writes performed.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
