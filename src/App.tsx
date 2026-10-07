import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SoftwareSelector } from './components/SoftwareSelector';
import { CompanyPeriodSection } from './components/CompanyPeriodSection';
import { DataInputSection } from './components/DataInputSection';
import { ResultsSummary } from './components/ResultsSummary';
import { FindingsList } from './components/FindingsList';
import { ExportSection } from './components/ExportSection';
import {
  AccountingSoftware,
  AccountingTransaction,
  FindingSeverity,
  ReviewReport,
} from './normalizer/commonModel';

import { runAccountingRules } from './rules/ruleEngine';
import { enrichFindingsWithAi } from './ai/aiExplainer';

// Multi-Client Architecture Imports
import {
  ClientCompany,
  ConsolidatedPortfolioReport,
  BatchReviewProgress,
  DataSourceType,
  LiveConnectionConfig,
} from './clients/clientModel';
import { runAllClientReviews } from './clients/clientReviewRunner';
import { ClientManagerSection } from './components/clients/ClientManagerSection';
import { BatchReviewProgressModal } from './components/clients/BatchReviewProgressModal';
import { ConsolidatedSummaryCards } from './components/clients/ConsolidatedSummaryCards';
import { ExecutiveAiSummaryCard } from './components/clients/ExecutiveAiSummaryCard';
import { MasterExportSection } from './components/clients/MasterExportSection';
import { ClientRiskMatrixTable } from './components/clients/ClientRiskMatrixTable';
import { ConsolidatedFindingsSection } from './components/clients/ConsolidatedFindingsSection';
import { AddClientModal } from './components/clients/AddClientModal';
import { ClientDataUploadModal } from './components/clients/ClientDataUploadModal';
import { ConnectionSettingsModal } from './components/clients/ConnectionSettingsModal';
import { DataPullLogModal } from './components/clients/DataPullLogModal';
import { ApiIntegrationSettingsModal } from './components/ApiIntegrationSettingsModal';

import { ArrowRight, ArrowLeft, Building2, CheckCircle2, Layers, UserCheck } from 'lucide-react';

export default function App() {
  // Navigation Mode: Multi-Client Platform (Default) vs. Single Client (Original MVP)
  const [viewMode, setViewMode] = useState<'multi_client' | 'single_client'>('multi_client');

  // ========================================================
  // MULTI-CLIENT PLATFORM STATE
  // ========================================================
  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [portfolioReport, setPortfolioReport] = useState<ConsolidatedPortfolioReport | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchReviewProgress | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [multiClientSeverityFilter, setMultiClientSeverityFilter] = useState<FindingSeverity | 'ALL'>('ALL');

  // Modals for Multi-Client & Global Config
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [clientForUpload, setClientForUpload] = useState<ClientCompany | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [clientForConnection, setClientForConnection] = useState<ClientCompany | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [clientForLog, setClientForLog] = useState<ClientCompany | null>(null);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);

  // Drill-down to specific client review from multi-client platform
  const [activeDrillDownClientId, setActiveDrillDownClientId] = useState<string | null>(null);

  // ========================================================
  // SINGLE-CLIENT MVP STATE (100% PRESERVED & FUNCTIONAL)
  // ========================================================
  const [software, setSoftware] = useState<AccountingSoftware>('TallyPrime');
  const [companyName, setCompanyName] = useState<string>('');
  const [periodFrom, setPeriodFrom] = useState<string>('');
  const [periodTo, setPeriodTo] = useState<string>('');
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [activeFileName, setActiveFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [reviewReport, setReviewReport] = useState<ReviewReport | null>(null);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<FindingSeverity | 'ALL'>('ALL');

  // --------------------------------------------------------
  // MULTI-CLIENT HANDLERS
  // --------------------------------------------------------
  const handleToggleSelectClient = (clientId: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, isSelected: !c.isSelected } : c))
    );
  };

  const handleToggleSelectAllClients = () => {
    const allSelected = clients.every((c) => c.isSelected);
    setClients((prev) => prev.map((c) => ({ ...c, isSelected: !allSelected })));
  };

  const handleRunSelectedReviews = async (fullSync = false) => {
    setIsBatchRunning(true);
    try {
      const { report, updatedClients } = await runAllClientReviews(clients, {
        fullSync,
        onProgress: (prog, currentList) => {
          setBatchProgress(prog);
          setClients(currentList);
        },
      });

      setClients(updatedClients);
      setPortfolioReport(report);
      setMultiClientSeverityFilter('ALL');

      // Scroll to consolidated results
      setTimeout(() => {
        const resultsEl = document.getElementById('portfolio-results-section');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 250);
    } catch (err) {
      console.error('Error running multi-client review batch:', err);
    } finally {
      setIsBatchRunning(false);
      setTimeout(() => setBatchProgress(null), 800);
    }
  };

  const handleRetryFailed = async () => {
    setIsBatchRunning(true);
    try {
      const { report, updatedClients } = await runAllClientReviews(clients, {
        retryFailedOnly: true,
        onProgress: (prog, currentList) => {
          setBatchProgress(prog);
          setClients(currentList);
        },
      });

      setClients(updatedClients);
      setPortfolioReport(report);
    } catch (err) {
      console.error('Error retrying failed reviews:', err);
    } finally {
      setIsBatchRunning(false);
      setTimeout(() => setBatchProgress(null), 800);
    }
  };

  const handleTriggerSingleSync = async (clientId: string, fullSync: boolean) => {
    const target = clients.find((c) => c.id === clientId);
    if (!target) return;

    setIsBatchRunning(true);
    try {
      const singleList = clients.map((c) => ({ ...c, isSelected: c.id === clientId }));
      const { report, updatedClients } = await runAllClientReviews(singleList, {
        fullSync,
        onProgress: (prog, currentList) => {
          setBatchProgress(prog);
          setClients((prev) =>
            prev.map((c) => (c.id === clientId ? currentList.find((x) => x.id === clientId) || c : c))
          );
        },
      });

      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? updatedClients.find((x) => x.id === clientId) || c : c))
      );
      setPortfolioReport(report);
    } catch (err) {
      console.error(`Error syncing client ${target.name}:`, err);
    } finally {
      setIsBatchRunning(false);
      setTimeout(() => setBatchProgress(null), 800);
    }
  };

  const handleAddClient = (newClient: ClientCompany) => {
    setClients((prev) => [newClient, ...prev]);
  };

  const handleDeleteClient = (clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    if (activeDrillDownClientId === clientId) {
      setActiveDrillDownClientId(null);
    }
  };

  const handleOpenUploadModal = (client: ClientCompany) => {
    setClientForUpload(client);
    setIsUploadModalOpen(true);
  };

  const handleOpenConnectionModal = (client: ClientCompany) => {
    setClientForConnection(client);
    setIsConnectionModalOpen(true);
  };

  const handleOpenLogModal = (client: ClientCompany) => {
    setClientForLog(client);
    setIsLogModalOpen(true);
  };

  const handleUpdateClientConnection = (
    clientId: string,
    dataSourceType: DataSourceType,
    liveConfig: LiveConnectionConfig,
    connectionStatus: 'CONNECTED' | 'FILE_LOADED' | 'SYNC_PENDING' | 'SYNC_FAILED'
  ) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
          return {
            ...c,
            dataSourceType,
            liveConfig,
            connectionStatus,
            connectionEndpoint:
              c.software === 'TallyPrime'
                ? `http://${liveConfig.tallyHost || 'localhost'}:${liveConfig.tallyPort || 9000}`
                : undefined,
            organizationId:
              c.software === 'Zoho Books' ? liveConfig.zohoOrgId : undefined,
          };
        }
        return c;
      })
    );
  };

  const handleUpdateClientTransactions = (
    clientId: string,
    newTx: AccountingTransaction[],
    fileName: string
  ) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
          return {
            ...c,
            transactions: newTx,
            activeFileName: fileName,
            dataSourceType: 'FILE',
            connectionStatus: 'FILE_LOADED',
            latestReport: undefined,
          };
        }
        return c;
      })
    );
  };

  const handleSelectClientForDetail = (clientId: string) => {
    const targetClient = clients.find((c) => c.id === clientId);
    if (!targetClient) return;

    if (!targetClient.latestReport && targetClient.transactions.length > 0) {
      const initialReport = runAccountingRules(
        targetClient.transactions,
        targetClient.name,
        targetClient.periodFrom,
        targetClient.periodTo,
        targetClient.software
      );
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, latestReport: initialReport } : c))
      );
    }

    setActiveDrillDownClientId(clientId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --------------------------------------------------------
  // SINGLE-CLIENT MVP HANDLERS (ORIGINAL PRESERVED)
  // --------------------------------------------------------
  const handleSelectSoftware = (newSoftware: AccountingSoftware) => {
    setSoftware(newSoftware);
    setCompanyName('');
    setTransactions([]);
    setActiveFileName('');
    setReviewReport(null);
  };



  const handleTransactionsLoaded = (loadedTx: AccountingTransaction[], fileName: string) => {
    setTransactions(loadedTx);
    setActiveFileName(fileName);
    setReviewReport(null);
  };

  const handleRunReview = async () => {
    if (transactions.length === 0) return;

    setIsAnalyzing(true);
    try {
      const initialReport = runAccountingRules(
        transactions,
        companyName || (software === 'TallyPrime' ? 'TallyPrime Company' : 'Zoho Books Company'),
        periodFrom,
        periodTo,
        software
      );

      const enrichedFindings = await enrichFindingsWithAi(
        initialReport.findings,
        companyName,
        software
      );

      setReviewReport({
        ...initialReport,
        findings: enrichedFindings,
      });
      setActiveSeverityFilter('ALL');

      setTimeout(() => {
        const resultsEl = document.getElementById('review-results-section');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    } catch (err) {
      console.error('Error running single client review:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };



  // Find active drill-down client if any
  const drillDownClient = activeDrillDownClientId
    ? clients.find((c) => c.id === activeDrillDownClientId)
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 1. Universal Top Header */}
      <Header
        hasData={clients.length > 0}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setActiveDrillDownClientId(null);
        }}
        clientCount={clients.length}
        onOpenApiSettings={() => setIsApiSettingsOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ========================================================
            VIEW MODE 1: MULTI-CLIENT PLATFORM VIEW
           ======================================================== */}
        {viewMode === 'multi_client' && (
          <>
            {/* If the accountant is drilling down into a single client's report from the multi-client view */}
            {drillDownClient ? (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Back to Multi-Client Breadcrumb Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveDrillDownClientId(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Multi-Client Overview</span>
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {drillDownClient.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            drillDownClient.software === 'TallyPrime'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {drillDownClient.software}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {drillDownClient.dataSourceType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        GSTIN: <span className="font-mono">{drillDownClient.gstin}</span> · {drillDownClient.industry}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenLogModal(drillDownClient)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <span>View Sync Log</span>
                    </button>

                    <button
                      onClick={() => handleOpenConnectionModal(drillDownClient)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <span>Connection Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setSoftware(drillDownClient.software);
                        setCompanyName(drillDownClient.name);
                        setPeriodFrom(drillDownClient.periodFrom);
                        setPeriodTo(drillDownClient.periodTo);
                        setTransactions(drillDownClient.transactions);
                        setActiveFileName(drillDownClient.activeFileName || 'Client Export');
                        if (drillDownClient.latestReport) {
                          setReviewReport(drillDownClient.latestReport);
                        }
                        setViewMode('single_client');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      title="Open in Single Client Workbench"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Open in Single-Client Mode</span>
                    </button>
                  </div>
                </div>

                {/* Drill-down Client Report */}
                {drillDownClient.latestReport ? (
                  <div className="space-y-6">
                    {/* Summary */}
                    <ResultsSummary
                      summary={drillDownClient.latestReport.summary}
                      activeFilter={activeSeverityFilter}
                      onFilterChange={setActiveSeverityFilter}
                    />

                    {/* Export */}
                    <ExportSection report={drillDownClient.latestReport} />

                    {/* Findings */}
                    <FindingsList
                      findings={drillDownClient.latestReport.findings}
                      activeFilter={activeSeverityFilter}
                      onFilterChange={setActiveSeverityFilter}
                    />
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 space-y-3">
                    <Building2 className="w-10 h-10 mx-auto text-slate-400" />
                    <div className="font-semibold text-slate-800">
                      No review report generated for this client yet
                    </div>
                    <p className="text-xs max-w-md mx-auto">
                      Click "Run Selected Client Reviews" or upload transactions to inspect anomalies.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Full Multi-Client Dashboard */
              <div className="space-y-6">
                {/* 1. Client Manager & "RUN SELECTED CLIENT REVIEWS" Action */}
                <ClientManagerSection
                  clients={clients}
                  onToggleSelect={handleToggleSelectClient}
                  onToggleSelectAll={handleToggleSelectAllClients}
                  onRunSelectedReviews={handleRunSelectedReviews}
                  onRetryFailed={handleRetryFailed}
                  isBatchRunning={isBatchRunning}
                  onOpenAddModal={() => setIsAddClientOpen(true)}
                  onOpenUploadModal={handleOpenUploadModal}
                  onOpenConnectionModal={handleOpenConnectionModal}
                  onOpenLogModal={handleOpenLogModal}
                  onSelectClientForDetail={handleSelectClientForDetail}
                  onDeleteClient={handleDeleteClient}
                  onTriggerSingleSync={handleTriggerSingleSync}
                  hasPortfolioResults={!!portfolioReport}
                  onJumpToPortfolioResults={() => {
                    document.getElementById('portfolio-results-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  onOpenApiSettings={() => setIsApiSettingsOpen(true)}
                />

                {/* 2. Consolidated Results (if batch has run) */}
                {portfolioReport && (
                  <div id="portfolio-results-section" className="space-y-6 pt-2">
                    {/* KPI Cards */}
                    <ConsolidatedSummaryCards
                      portfolio={portfolioReport}
                      activeFilter={multiClientSeverityFilter}
                      onFilterChange={setMultiClientSeverityFilter}
                    />

                    {/* AI Multi-Client Executive Briefing */}
                    <ExecutiveAiSummaryCard
                      summary={portfolioReport.executiveAiSummary}
                      totalClients={portfolioReport.totalClientsReviewed}
                    />

                    {/* Master Export Section */}
                    <MasterExportSection
                      portfolio={portfolioReport}
                      clients={clients}
                    />

                    {/* Client Comparison Risk Matrix */}
                    <ClientRiskMatrixTable
                      portfolio={portfolioReport}
                      clients={clients}
                      onSelectClientForDetail={handleSelectClientForDetail}
                      onOpenLogModal={handleOpenLogModal}
                    />

                    {/* Consolidated Master Findings List */}
                    <ConsolidatedFindingsSection
                      portfolio={portfolioReport}
                      clients={clients}
                      activeSeverityFilter={multiClientSeverityFilter}
                      onSeverityFilterChange={setMultiClientSeverityFilter}
                      onSelectClientForDetail={handleSelectClientForDetail}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ========================================================
            VIEW MODE 2: SINGLE CLIENT REVIEW (ORIGINAL MVP WORKFLOW)
           ======================================================== */}
        {viewMode === 'single_client' && (
          <div className="space-y-6">
            {/* Workflow guide pill */}
            <div className="hidden sm:flex items-center justify-between text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-2xs">
              <span className="font-semibold text-slate-700">Single Client Review Workflow:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-900 font-medium">1. Select Software</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="text-slate-900 font-medium">2. Data Input</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="text-slate-900 font-medium">3. Period</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="text-slate-900 font-medium">4. Run Review</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="text-slate-900 font-medium">5. View Findings</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="text-slate-900 font-medium">6. Export Report</span>
              </div>
            </div>

            {/* Input Configuration Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-6">
              {/* 2. Accounting Software */}
              <SoftwareSelector
                selectedSoftware={software}
                onSelect={handleSelectSoftware}
              />

              <hr className="border-slate-100" />

              {/* 3 & 4. Company & Period */}
              <CompanyPeriodSection
                companyName={companyName}
                onCompanyChange={setCompanyName}
                periodFrom={periodFrom}
                onPeriodFromChange={setPeriodFrom}
                periodTo={periodTo}
                onPeriodToChange={setPeriodTo}
              />

              <hr className="border-slate-100" />

              {/* 5 & 6. Data Input & Run Review Button */}
              <DataInputSection
                software={software}
                companyName={companyName}
                transactions={transactions}
                onTransactionsLoaded={handleTransactionsLoaded}
                onRunReview={handleRunReview}
                isAnalyzing={isAnalyzing}
                activeFileName={activeFileName}
              />
            </div>

            {/* 7 & 8 & 9. Results & Findings & Export */}
            {reviewReport && (
              <div id="review-results-section" className="space-y-6 pt-2">
                {/* 7. Results */}
                <ResultsSummary
                  summary={reviewReport.summary}
                  activeFilter={activeSeverityFilter}
                  onFilterChange={setActiveSeverityFilter}
                />

                {/* 9. Export */}
                <ExportSection report={reviewReport} />

                {/* 8. Findings List */}
                <FindingsList
                  findings={reviewReport.findings}
                  activeFilter={activeSeverityFilter}
                  onFilterChange={setActiveSeverityFilter}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Progress Modal during One-Click Multi-Client Review */}
      <BatchReviewProgressModal
        isOpen={isBatchRunning}
        progress={batchProgress}
        clients={clients}
      />

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        onAddClient={handleAddClient}
      />

      {/* Upload Data / Sync Modal */}
      <ClientDataUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setClientForUpload(null);
        }}
        client={clientForUpload}
        onUpdateClientTransactions={handleUpdateClientTransactions}
      />

      {/* Connection Settings & Test Modal */}
      <ConnectionSettingsModal
        isOpen={isConnectionModalOpen}
        onClose={() => {
          setIsConnectionModalOpen(false);
          setClientForConnection(null);
        }}
        client={clientForConnection}
        onUpdateClientConnection={handleUpdateClientConnection}
        onTriggerSync={handleTriggerSingleSync}
      />

      {/* Technical Data Pull Log Modal */}
      <DataPullLogModal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false);
          setClientForLog(null);
        }}
        client={clientForLog}
      />

      {/* Global API Integration Settings Modal */}
      <ApiIntegrationSettingsModal
        isOpen={isApiSettingsOpen}
        onClose={() => setIsApiSettingsOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">Accounting AI Review</span> · Real Multi-Client Data Collection & Audit Control Center
          </div>
          <div>
            Read-only live connector and file snapshot architecture for TallyPrime and Zoho Books
          </div>
        </div>
      </footer>
    </div>
  );
}
