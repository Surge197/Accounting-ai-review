import {
  AccountingSoftware,
  AccountingTransaction,
  ReviewFinding,
  ReviewReport,
} from '../normalizer/commonModel';
import { ClientSnapshot } from '../snapshot/snapshotEngine';

export type ConnectionStatus = 'CONNECTED' | 'FILE_LOADED' | 'SYNC_PENDING' | 'SYNC_FAILED';

export type DataSourceType = 'LIVE' | 'FILE';

export type ClientReviewStatus = 'IDLE' | 'SYNCING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

export type ClientRiskScore = 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Clean';

export interface SyncLogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface LiveConnectionConfig {
  tallyHost?: string;
  tallyPort?: number;
  tallyCompany?: string;
  zohoOrgId?: string;
  zohoOrgName?: string;
  zohoDataCenter?: 'in' | 'com' | 'eu' | 'com.au';
  zohoAccessToken?: string;
}

export interface ClientCompany {
  id: string;
  name: string;
  software: AccountingSoftware;
  gstin: string;
  industry: string;
  group: string;
  connectionStatus: ConnectionStatus;
  dataSourceType: DataSourceType; // LIVE | FILE
  liveConfig?: LiveConnectionConfig;
  connectionEndpoint?: string;
  organizationId?: string;
  periodFrom: string;
  periodTo: string;
  transactions: AccountingTransaction[];
  activeFileName?: string;
  latestReport?: ReviewReport;
  isSelected: boolean;
  reviewStatus: ClientReviewStatus;
  lastReviewedAt?: string;
  lastSyncType?: 'FULL' | 'INCREMENTAL' | 'FILE_IMPORT';
  lastSyncTimestamp?: string;
  syncLogs: SyncLogEntry[];
  currentSnapshot?: ClientSnapshot;
  snapshots?: ClientSnapshot[];
  errorMessage?: string;
}

export interface ClientReviewSummaryItem {
  clientId: string;
  clientName: string;
  software: AccountingSoftware;
  dataSourceType: DataSourceType;
  transactionsCount: number;
  criticalCount: number;
  reviewCount: number;
  observationCount: number;
  flaggedAmount: number;
  riskScore: ClientRiskScore;
  status: ClientReviewStatus;
  syncStatus: ConnectionStatus;
  lastSyncTimestamp?: string;
  snapshotDiffSummary?: string;
}

export interface ConsolidatedPortfolioReport {
  totalClients: number;
  totalClientsReviewed: number;
  successfulCount: number;
  failedCount: number;
  skippedCount: number;
  totalTransactions: number;
  criticalIssues: number;
  requiresReview: number;
  observations: number;
  totalFlaggedAmount: number;
  clientSummaries: ClientReviewSummaryItem[];
  allFindings: Array<
    ReviewFinding & {
      clientId: string;
      clientName: string;
      software: AccountingSoftware;
      source?: DataSourceType;
    }
  >;
  executiveAiSummary?: string;
  runTimestamp: string;
}

export interface BatchReviewProgress {
  currentClientIndex: number;
  totalClients: number;
  currentClientName: string;
  currentStage: 'Connecting' | 'Pulling Data' | 'Normalizing' | 'Snapshot' | 'Running 18 Rules' | 'AI Insights' | 'Completed';
  percentComplete: number;
  isFinished: boolean;
  logMessage?: string;
}
