import {
  ClientCompany,
  ConsolidatedPortfolioReport,
  ClientReviewSummaryItem,
  BatchReviewProgress,
  ClientRiskScore,
  SyncLogEntry,
} from './clientModel';
import { runAccountingRules } from '../rules/ruleEngine';
import { enrichFindingsWithAi } from '../ai/aiExplainer';
import { ReviewFinding, ReviewReport, AccountingTransaction } from '../normalizer/commonModel';
import { TallyConnector } from '../connectors/tallyConnector';
import { ZohoBooksConnector } from '../connectors/zohoConnector';
import { createClientSnapshot } from '../snapshot/snapshotEngine';

export interface RunAllOptions {
  onProgress?: (progress: BatchReviewProgress, currentClients: ClientCompany[]) => void;
  runAiEnrichment?: boolean;
  fullSync?: boolean;
  retryFailedOnly?: boolean;
}

const getTimestamp = () => new Date().toLocaleTimeString('en-GB');

export async function runAllClientReviews(
  clients: ClientCompany[],
  options: RunAllOptions = {}
): Promise<{ report: ConsolidatedPortfolioReport; updatedClients: ClientCompany[] }> {
  const { onProgress, runAiEnrichment = true, fullSync = false, retryFailedOnly = false } = options;
  const updatedClients: ClientCompany[] = [...clients];

  // Filter candidates for review
  const targetClients = updatedClients.filter((c) => {
    if (retryFailedOnly) return c.reviewStatus === 'FAILED' && c.isSelected;
    return c.isSelected;
  });

  const totalToReview = targetClients.length;
  let processedCount = 0;
  let successfulCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < updatedClients.length; i++) {
    const client = updatedClients[i];

    // If client is not in target list, skip
    if (!targetClients.some((t) => t.id === client.id)) {
      skippedCount++;
      continue;
    }

    processedCount++;
    const clientLogs: SyncLogEntry[] = [...(client.syncLogs || [])];
    const addLog = (message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      clientLogs.push({ timestamp: getTimestamp(), level, message });
    };

    // Stage 1: Connecting
    updatedClients[i] = {
      ...client,
      reviewStatus: 'SYNCING',
      syncLogs: clientLogs,
    };

    onProgress?.(
      {
        currentClientIndex: processedCount,
        totalClients: totalToReview,
        currentClientName: client.name,
        currentStage: 'Connecting',
        percentComplete: Math.round(((processedCount - 0.8) / totalToReview) * 100),
        isFinished: false,
        logMessage: `${client.name}: Connecting via ${client.software} connector...`,
      },
      [...updatedClients]
    );

    addLog(`Initiating review for ${client.name} using ${client.software} connector`, 'info');

    let pulledTransactions: AccountingTransaction[] = client.transactions || [];

    // Stage 2: Pulling Data
    try {
      if (client.dataSourceType === 'LIVE') {
        onProgress?.(
          {
            currentClientIndex: processedCount,
            totalClients: totalToReview,
            currentClientName: client.name,
            currentStage: 'Pulling Data',
            percentComplete: Math.round(((processedCount - 0.6) / totalToReview) * 100),
            isFinished: false,
            logMessage: `${client.name}: Pulling live records from ${client.software}...`,
          },
          [...updatedClients]
        );

        if (client.software === 'TallyPrime') {
          addLog(`Probing live Tally at ${client.liveConfig?.tallyHost || 'localhost'}:${client.liveConfig?.tallyPort || 9000}`, 'info');
          pulledTransactions = await TallyConnector.getTransactions(
            {
              software: 'TallyPrime',
              tallyHost: client.liveConfig?.tallyHost,
              tallyPort: client.liveConfig?.tallyPort,
              tallyCompany: client.liveConfig?.tallyCompany || client.name,
            },
            {
              fromDate: client.periodFrom,
              toDate: client.periodTo,
              fullSync,
              clientId: client.id,
              clientName: client.name,
              onLog: (msg, lvl) => addLog(msg, lvl || 'info'),
            }
          );
        } else {
          addLog(`Calling Zoho Books API for Org ${client.liveConfig?.zohoOrgId || 'default'}`, 'info');
          pulledTransactions = await ZohoBooksConnector.getTransactions(
            {
              software: 'Zoho Books',
              zohoOrgId: client.liveConfig?.zohoOrgId,
              zohoOrgName: client.liveConfig?.zohoOrgName || client.name,
              zohoDataCenter: client.liveConfig?.zohoDataCenter || 'in',
              zohoAccessToken: client.liveConfig?.zohoAccessToken,
            },
            {
              fromDate: client.periodFrom,
              toDate: client.periodTo,
              fullSync,
              clientId: client.id,
              clientName: client.name,
              onLog: (msg, lvl) => addLog(msg, lvl || 'info'),
            }
          );
        }
      } else if (client.dataSourceType === 'FILE') {
        addLog(`Loading staged transactions from file "${client.activeFileName}"`, 'info');
        if (pulledTransactions.length === 0) {
          throw new Error(`File-backed client has no staged transactions. Please upload a file.`);
        }
        addLog(`Verified ${pulledTransactions.length} file transactions`, 'success');
      } else {
        // SAMPLE Benchmark
        addLog(`Loading benchmark dataset for ${client.software} review`, 'info');
        if (pulledTransactions.length === 0) {
          throw new Error(`Client dataset is empty. Please upload data or configure live sync.`);
        }
        addLog(`Loaded ${pulledTransactions.length} benchmark ledger transactions`, 'success');
      }

      // Tag client isolation fields on all transactions
      const isolatedTransactions = pulledTransactions.map((tx) => ({
        ...tx,
        clientId: client.id,
        clientName: client.name,
        source: client.dataSourceType,
      }));

      // Stage 3: Snapshot Diff
      onProgress?.(
        {
          currentClientIndex: processedCount,
          totalClients: totalToReview,
          currentClientName: client.name,
          currentStage: 'Snapshot',
          percentComplete: Math.round(((processedCount - 0.45) / totalToReview) * 100),
          isFinished: false,
          logMessage: `${client.name}: Computing transaction snapshot diff...`,
        },
        [...updatedClients]
      );

      const newSnapshot = createClientSnapshot(
        client.id,
        client.name,
        client.dataSourceType,
        isolatedTransactions,
        client.currentSnapshot
      );

      const diff = newSnapshot.diffFromPrevious;
      if (diff) {
        addLog(
          `Snapshot diff: ${diff.addedCount} added, ${diff.modifiedCount} modified, ${diff.deletedCount} deleted, ${diff.unchangedCount} unchanged`,
          'info'
        );
      }

      // Stage 4: Running 18 Accounting Rules
      onProgress?.(
        {
          currentClientIndex: processedCount,
          totalClients: totalToReview,
          currentClientName: client.name,
          currentStage: 'Running 18 Rules',
          percentComplete: Math.round(((processedCount - 0.3) / totalToReview) * 100),
          isFinished: false,
          logMessage: `${client.name}: Applying 18 deterministic accounting checks...`,
        },
        [...updatedClients]
      );

      const rawReport = runAccountingRules(
        isolatedTransactions,
        client.name,
        client.periodFrom,
        client.periodTo,
        client.software
      );

      // Ensure findings are also stamped with traceability
      const isolatedFindings = rawReport.findings.map((f) => ({
        ...f,
        clientId: client.id,
        company: client.name,
        source: client.dataSourceType,
      }));

      addLog(
        `Review complete: ${rawReport.summary.criticalIssues} critical, ${rawReport.summary.requiresReview} requires review, ${rawReport.summary.observations} observations`,
        'success'
      );

      // Stage 5: AI Insights
      let finalFindings = isolatedFindings;
      if (runAiEnrichment && finalFindings.length > 0) {
        onProgress?.(
          {
            currentClientIndex: processedCount,
            totalClients: totalToReview,
            currentClientName: client.name,
            currentStage: 'AI Insights',
            percentComplete: Math.round(((processedCount - 0.1) / totalToReview) * 100),
            isFinished: false,
            logMessage: `${client.name}: Enriching findings with AI audit explanations...`,
          },
          [...updatedClients]
        );

        const enriched = await enrichFindingsWithAi(
          isolatedFindings,
          client.name,
          client.software
        );

        finalFindings = enriched.map((f) => ({
          ...f,
          clientId: client.id,
          company: client.name,
          source: client.dataSourceType,
        }));
      }

      const clientReport: ReviewReport = {
        ...rawReport,
        findings: finalFindings,
        transactions: isolatedTransactions,
      };

      updatedClients[i] = {
        ...client,
        transactions: isolatedTransactions,
        reviewStatus: 'COMPLETED',
        latestReport: clientReport,
        lastReviewedAt: new Date().toISOString(),
        lastSyncTimestamp: new Date().toISOString(),
        lastSyncType: fullSync ? 'FULL' : 'INCREMENTAL',
        syncLogs: clientLogs,
        currentSnapshot: newSnapshot,
        snapshots: [newSnapshot, ...(client.snapshots || []).slice(0, 4)],
        errorMessage: undefined,
      };

      successfulCount++;
    } catch (err: any) {
      console.warn(`Review failed for client ${client.name}:`, err);
      addLog(`Review failed: ${err.message}`, 'error');

      updatedClients[i] = {
        ...client,
        reviewStatus: 'FAILED',
        errorMessage: err.message || 'Data retrieval or analysis rule failure.',
        syncLogs: clientLogs,
      };

      failedCount++;
    }
  }

  // Final progress emit
  onProgress?.(
    {
      currentClientIndex: totalToReview,
      totalClients: totalToReview,
      currentClientName: 'All Clients',
      currentStage: 'Completed',
      percentComplete: 100,
      isFinished: true,
      logMessage: `Batch review completed: ${successfulCount} successful, ${failedCount} failed, ${skippedCount} skipped.`,
    },
    [...updatedClients]
  );

  const consolidated = await aggregatePortfolioReport(
    updatedClients,
    successfulCount,
    failedCount,
    skippedCount
  );

  return {
    report: consolidated,
    updatedClients,
  };
}

export async function aggregatePortfolioReport(
  clients: ClientCompany[],
  successfulCount: number = 0,
  failedCount: number = 0,
  skippedCount: number = 0
): Promise<ConsolidatedPortfolioReport> {
  const reviewedClients = clients.filter((c) => c.reviewStatus === 'COMPLETED' && c.latestReport);

  let totalTransactions = 0;
  let totalCritical = 0;
  let totalRequiresReview = 0;
  let totalObservations = 0;
  let totalFlaggedAmount = 0;

  const clientSummaries: ClientReviewSummaryItem[] = [];
  const allFindings: Array<
    ReviewFinding & {
      clientId: string;
      clientName: string;
      software: 'TallyPrime' | 'Zoho Books';
      source?: 'LIVE' | 'FILE' | 'SAMPLE';
    }
  > = [];

  for (const c of clients) {
    let diffSummary = 'No changes';
    if (c.currentSnapshot?.diffFromPrevious) {
      const d = c.currentSnapshot.diffFromPrevious;
      diffSummary = `+${d.addedCount} / ~${d.modifiedCount} / -${d.deletedCount}`;
    }

    if (c.latestReport) {
      const summary = c.latestReport.summary;
      totalTransactions += summary.transactionsAnalysed;
      totalCritical += summary.criticalIssues;
      totalRequiresReview += summary.requiresReview;
      totalObservations += summary.observations;
      totalFlaggedAmount += summary.totalFlaggedAmount;

      const riskScore: ClientRiskScore =
        summary.criticalIssues > 0
          ? 'High Risk'
          : summary.requiresReview >= 2
          ? 'Medium Risk'
          : summary.observations > 0 || summary.requiresReview > 0
          ? 'Low Risk'
          : 'Clean';

      clientSummaries.push({
        clientId: c.id,
        clientName: c.name,
        software: c.software,
        dataSourceType: c.dataSourceType,
        transactionsCount: summary.transactionsAnalysed,
        criticalCount: summary.criticalIssues,
        reviewCount: summary.requiresReview,
        observationCount: summary.observations,
        flaggedAmount: summary.totalFlaggedAmount,
        riskScore,
        status: c.reviewStatus,
        syncStatus: c.connectionStatus,
        lastSyncTimestamp: c.lastSyncTimestamp,
        snapshotDiffSummary: diffSummary,
      });

      for (const f of c.latestReport.findings) {
        allFindings.push({
          ...f,
          clientId: c.id,
          clientName: c.name,
          software: c.software,
          source: c.dataSourceType,
        });
      }
    } else {
      clientSummaries.push({
        clientId: c.id,
        clientName: c.name,
        software: c.software,
        dataSourceType: c.dataSourceType,
        transactionsCount: c.transactions.length,
        criticalCount: 0,
        reviewCount: 0,
        observationCount: 0,
        flaggedAmount: 0,
        riskScore: 'Clean',
        status: c.reviewStatus,
        syncStatus: c.connectionStatus,
        lastSyncTimestamp: c.lastSyncTimestamp,
        snapshotDiffSummary: diffSummary,
      });
    }
  }

  // Sort findings by severity
  const severityRank: Record<string, number> = {
    Critical: 3,
    'Requires review': 2,
    Observation: 1,
  };
  allFindings.sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0));

  // Sort client summaries by critical count descending
  clientSummaries.sort((a, b) => b.criticalCount - a.criticalCount || b.flaggedAmount - a.flaggedAmount);

  // Fetch executive AI summary from /api/ai/portfolio-summary
  let executiveAiSummary: string | undefined = undefined;
  if (reviewedClients.length > 0) {
    try {
      const res = await fetch('/api/ai/portfolio-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientsSummary: clientSummaries.map((s) => ({
            clientName: s.clientName,
            software: s.software,
            source: s.dataSourceType,
            transactionsCount: s.transactionsCount,
            criticalCount: s.criticalCount,
            reviewCount: s.reviewCount,
            observationCount: s.observationCount,
            flaggedAmount: s.flaggedAmount,
            riskScore: s.riskScore,
          })),
          totalFlaggedAmount,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        executiveAiSummary = data.summary;
      }
    } catch (err) {
      console.warn('Portfolio AI summary request failed:', err);
    }
  }

  return {
    totalClients: clients.length,
    totalClientsReviewed: reviewedClients.length,
    successfulCount: successfulCount || reviewedClients.length,
    failedCount: failedCount || clients.filter((c) => c.reviewStatus === 'FAILED').length,
    skippedCount: skippedCount || (clients.length - (successfulCount + failedCount)),
    totalTransactions,
    criticalIssues: totalCritical,
    requiresReview: totalRequiresReview,
    observations: totalObservations,
    totalFlaggedAmount,
    clientSummaries,
    allFindings,
    executiveAiSummary,
    runTimestamp: new Date().toISOString(),
  };
}
