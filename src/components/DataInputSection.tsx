import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Play, Sparkles, RefreshCw } from 'lucide-react';
import { AccountingSoftware, AccountingTransaction } from '../normalizer/commonModel';
import { normalizeAccountingData } from '../normalizer/normalizer';

interface DataInputSectionProps {
  software: AccountingSoftware;
  companyName: string;
  transactions: AccountingTransaction[];
  onTransactionsLoaded: (transactions: AccountingTransaction[], sourceFileName: string) => void;
  onRunReview: () => void;
  isAnalyzing: boolean;
  activeFileName?: string;
}

export const DataInputSection: React.FC<DataInputSectionProps> = ({
  software,
  companyName,
  transactions,
  onTransactionsLoaded,
  onRunReview,
  isAnalyzing,
  activeFileName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setIsLoadingFile(true);

    try {
      const fileName = file.name;
      const extension = fileName.split('.').pop()?.toLowerCase();
      const validExtensions = ['csv', 'xlsx', 'xls', 'xml', 'json'];

      if (!extension || !validExtensions.includes(extension)) {
        throw new Error('Unsupported format. Please upload CSV, Excel (.xlsx/.xls), Tally XML, or JSON.');
      }

      let content: string | ArrayBuffer;
      if (extension === 'xlsx' || extension === 'xls') {
        content = await file.arrayBuffer();
      } else {
        content = await file.text();
      }

      const parsedTx = await normalizeAccountingData(content, fileName, software, companyName || 'Company');
      if (parsedTx.length === 0) {
        throw new Error(`No valid accounting transactions could be extracted from "${fileName}". Verify file content.`);
      }

      onTransactionsLoaded(parsedTx, fileName);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMsg(err.message || 'Failed to parse file.');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Data Input ({software})
        </label>
        <span className="text-[11px] text-slate-500">
          Supported: CSV, Excel (.xlsx/.xls), Tally XML, JSON
        </span>
      </div>

      {/* Upload Box */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-slate-900 bg-slate-100'
            : transactions.length > 0
            ? 'border-slate-300 bg-slate-50/70 hover:bg-slate-100/70'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.xml,.json"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          {isLoadingFile ? (
            <>
              <RefreshCw className="w-8 h-8 text-slate-500 animate-spin" />
              <div className="text-sm font-medium text-slate-700">Parsing accounting dataset...</div>
            </>
          ) : transactions.length > 0 ? (
            <>
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {activeFileName || `${software} Accounting Records`}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {transactions.length} transactions loaded & normalized ready for review · Click to replace file
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Drop {software} data file here, or browse
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Upload CSV, Excel, XML, or JSON exported from {software}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>
            {transactions.length > 0
              ? `${transactions.length} records staged for rule verification`
              : 'Waiting for data import or sample selection'}
          </span>
        </div>

        <button
          type="button"
          onClick={onRunReview}
          disabled={transactions.length === 0 || isAnalyzing}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition-all ${
            transactions.length === 0 || isAnalyzing
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99]'
          }`}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Running Accounting Engine & AI Review...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Review</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
