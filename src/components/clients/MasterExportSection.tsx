import React, { useState } from 'react';
import { FileSpreadsheet, Printer, Download, Check, Sparkles, Layers } from 'lucide-react';
import { ConsolidatedPortfolioReport, ClientCompany } from '../../clients/clientModel';
import { downloadMasterExcelReport } from '../../reports/masterExcelExporter';
import { printMasterPdfReport } from '../../reports/masterPdfExporter';

interface MasterExportSectionProps {
  portfolio: ConsolidatedPortfolioReport;
  clients: ClientCompany[];
}

export const MasterExportSection: React.FC<MasterExportSectionProps> = ({
  portfolio,
  clients,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleExcelExport = () => {
    downloadMasterExcelReport(portfolio, clients);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  const handlePdfPrint = () => {
    printMasterPdfReport(portfolio, clients);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            Consolidated Multi-Client Audit Export
          </h3>
          <p className="text-xs text-slate-500">
            Export comprehensive standardized reports for all {portfolio.totalClientsReviewed} reviewed clients in one operation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Master Excel */}
          <button
            onClick={handleExcelExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-2xs"
            title="Download multi-tab Excel workbook with portfolio summary, consolidated findings, and client tabs"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Master Excel</span>
              </>
            )}
          </button>

          {/* Print / Save Master PDF */}
          <button
            onClick={handlePdfPrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 text-white transition-colors shadow-2xs"
            title="Print or save PDF of consolidated portfolio executive review"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Print Master PDF</span>
          </button>
        </div>
      </div>

      {/* Breakdown notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <strong className="text-slate-800 block mb-0.5">Sheet 1: Portfolio Summary</strong>
          <span>Executive metrics, client risk rankings, and portfolio exposure breakdown.</span>
        </div>
        <div>
          <strong className="text-slate-800 block mb-0.5">Sheet 2: Consolidated Findings</strong>
          <span>All {portfolio.allFindings.length} findings with AI explanations & verification actions.</span>
        </div>
        <div>
          <strong className="text-slate-800 block mb-0.5">Sheets 3..N: Client Tabs</strong>
          <span>Individual ledger records and findings isolated per company.</span>
        </div>
      </div>
    </div>
  );
};
