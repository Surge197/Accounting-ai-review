import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, FileSpreadsheet, Building2, RefreshCw } from 'lucide-react';
import { ClientCompany } from '../../clients/clientModel';
import { normalizeAccountingData } from '../../normalizer/normalizer';
import { AccountingTransaction } from '../../normalizer/commonModel';

interface ClientDataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientCompany | null;
  onUpdateClientTransactions: (clientId: string, transactions: AccountingTransaction[], fileName: string) => void;
}

export const ClientDataUploadModal: React.FC<ClientDataUploadModalProps> = ({
  isOpen,
  onClose,
  client,
  onUpdateClientTransactions,
}) => {
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stagedTransactions, setStagedTransactions] = useState<AccountingTransaction[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState('');

  if (!isOpen || !client) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setErrorMessage('');
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      let content: string | ArrayBuffer;
      if (extension === 'xlsx' || extension === 'xls') {
        content = await file.arrayBuffer();
      } else {
        content = await file.text();
      }

      const txs = await normalizeAccountingData(content, file.name, client.software, client.name);
      if (txs.length === 0) {
        throw new Error('No valid transactions found in file. Ensure required columns (Date, Amount/Voucher) are present.');
      }
      setStagedTransactions(txs);
      setUploadedFileName(file.name);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = () => {
    if (stagedTransactions.length > 0 && uploadedFileName) {
      onUpdateClientTransactions(client.id, stagedTransactions, uploadedFileName);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Upload Data / Sync</h3>
              <p className="text-xs text-slate-500">{client.name} · {client.software}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status info */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Current Ledger Records:</span>
            <span className="font-semibold text-slate-800">{client.transactions.length} transactions</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Active Source File:</span>
            <span className="font-mono text-slate-700 truncate max-w-[240px]">
              {client.activeFileName || 'None'}
            </span>
          </div>
          {client.connectionEndpoint && (
            <div className="flex justify-between">
              <span className="text-slate-500">Gateway:</span>
              <span className="font-mono text-slate-700">{client.connectionEndpoint}</span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* File Drop Area */}
        <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-6 text-center space-y-2 bg-slate-50/50 transition-colors">
          <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-xs text-slate-700 font-medium">
            Upload new data file for {client.name}
          </div>
          <p className="text-[11px] text-slate-400">
            Supports Tally XML, Excel (.xlsx, .xls), CSV, or JSON
          </p>
          <div className="pt-2">
            <input
              type="file"
              accept=".xml,.csv,.xlsx,.xls,.json"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white hover:file:bg-slate-100 cursor-pointer"
            />
          </div>
        </div>

        {isParsing && (
          <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 py-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Normalizing and staging accounting transactions...
          </div>
        )}

        {stagedTransactions.length > 0 && !isParsing && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Ready to stage {stagedTransactions.length} transactions from <strong>{uploadedFileName}</strong></span>
            </div>
          </div>
        )}

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={stagedTransactions.length === 0}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs"
          >
            Apply to Client
          </button>
        </div>
      </div>
    </div>
  );
};
