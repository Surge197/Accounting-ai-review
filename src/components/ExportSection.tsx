import React, { useState } from 'react';
import { ReviewReport } from '../normalizer/commonModel';
import { downloadExcelReport } from '../reports/excelExporter';
import { printOrDownloadPdfReport } from '../reports/pdfExporter';
import { FileDown, Printer, FileSpreadsheet, Eye } from 'lucide-react';
import { ReportViewModal } from './ReportViewModal';

interface ExportSectionProps {
  report: ReviewReport;
}

export const ExportSection: React.FC<ExportSectionProps> = ({ report }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Export Standardized Review Report
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Share with partners, external auditors, or store in permanent tax compliance audit files
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preview Full Report */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Preview Report</span>
          </button>

          {/* Download Excel Report */}
          <button
            type="button"
            onClick={() => downloadExcelReport(report)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel Report (.xlsx)</span>
          </button>

          {/* Download PDF / Print */}
          <button
            type="button"
            onClick={() => printOrDownloadPdfReport(report)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4" />
            <span>Download PDF Report</span>
          </button>
        </div>
      </div>

      {showModal && (
        <ReportViewModal report={report} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};
