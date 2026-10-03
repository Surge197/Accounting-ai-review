import { AccountingSoftware, AccountingTransaction } from '../normalizer/commonModel';

export type ConnectionTestStatus =
  | 'CONNECTED'
  | 'TALLY_NOT_REACHABLE'
  | 'COMPANY_NOT_FOUND'
  | 'INVALID_RESPONSE'
  | 'TIMEOUT'
  | 'AUTH_REQUIRED'
  | 'ORG_NOT_FOUND'
  | 'FAILED';

export interface ConnectorConfig {
  software: AccountingSoftware;
  // Tally specific
  tallyHost?: string;
  tallyPort?: number;
  tallyCompany?: string;
  // Zoho specific
  zohoOrgId?: string;
  zohoOrgName?: string;
  zohoDataCenter?: 'in' | 'com' | 'eu' | 'com.au';
  zohoClientId?: string;
  zohoClientSecret?: string;
  zohoAccessToken?: string;
  zohoRefreshToken?: string;
  // State
  isLiveConnected?: boolean;
}

export interface SyncOptions {
  fromDate?: string;
  toDate?: string;
  lastSyncTime?: string;
  fullSync?: boolean;
  clientId?: string;
  clientName?: string;
  onLog?: (message: string, level?: 'info' | 'success' | 'warn' | 'error') => void;
}

export interface ConnectionTestResult {
  status: ConnectionTestStatus;
  message: string;
  latencyMs?: number;
  details?: Record<string, any>;
}

export interface CompanyInfo {
  name: string;
  gstin?: string;
  currency?: string;
  financialYear?: string;
  software: AccountingSoftware;
  rawDetails?: Record<string, any>;
}

export interface MasterEntity {
  id: string;
  name: string;
  type?: string;
  group?: string;
  gstin?: string;
  balance?: number;
}

export interface TaxRateInfo {
  name: string;
  rate: number;
  type?: 'CGST' | 'SGST' | 'IGST' | 'CESS';
}

/**
 * Common Accounting Connector Interface
 * Both TallyConnector and ZohoBooksConnector implement this standard interface.
 * The review engine receives the exact same normalized AccountingTransaction model regardless of source.
 */
export interface AccountingConnector {
  readonly software: AccountingSoftware;
  readonly name: string;

  connect(config: ConnectorConfig): Promise<{ success: boolean; message: string }>;
  disconnect(config: ConnectorConfig): Promise<void>;
  testConnection(config: ConnectorConfig): Promise<ConnectionTestResult>;
  getCompanyInfo(config: ConnectorConfig): Promise<CompanyInfo>;
  getAccounts(config: ConnectorConfig): Promise<MasterEntity[]>;
  getCustomers(config: ConnectorConfig): Promise<MasterEntity[]>;
  getVendors(config: ConnectorConfig): Promise<MasterEntity[]>;
  getTransactions(config: ConnectorConfig, options?: SyncOptions): Promise<AccountingTransaction[]>;
  getBalances(config: ConnectorConfig): Promise<Record<string, number>>;
  getTaxes(config: ConnectorConfig): Promise<TaxRateInfo[]>;
  getFinancialSummary(config: ConnectorConfig): Promise<Record<string, any>>;
  parseFile(fileContent: string | ArrayBuffer, fileName: string, companyName: string): Promise<AccountingTransaction[]>;
}
