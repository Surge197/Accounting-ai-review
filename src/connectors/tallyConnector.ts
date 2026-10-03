import { AccountingTransaction, AccountingSoftware } from '../normalizer/commonModel';
import { parseTallyData } from '../tally/tallyNormalizer';
import { parseTallyXmlDoc } from '../tally/tallyXmlParser';
import {
  AccountingConnector,
  ConnectorConfig,
  SyncOptions,
  ConnectionTestResult,
  CompanyInfo,
  MasterEntity,
  TaxRateInfo,
} from './accountingConnector';

export const TallyConnector: AccountingConnector = {
  software: 'TallyPrime',
  name: 'TallyPrime XML/ODBC Connector',

  async connect(config: ConnectorConfig): Promise<{ success: boolean; message: string }> {
    const test = await this.testConnection(config);
    return {
      success: test.status === 'CONNECTED',
      message: test.message,
    };
  },

  async disconnect(_config: ConnectorConfig): Promise<void> {
    // Stateless HTTP server in Tally
    return Promise.resolve();
  },

  async testConnection(config: ConnectorConfig): Promise<ConnectionTestResult> {
    try {
      const response = await fetch('/api/tally/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: config.tallyHost || 'localhost',
          port: config.tallyPort || 9000,
          company: config.tallyCompany || '',
        }),
      });

      if (!response.ok) {
        return {
          status: 'FAILED',
          message: `Server returned HTTP ${response.status} while testing Tally connection.`,
        };
      }

      const data = await response.json();
      return {
        status: data.status,
        message: data.message,
        latencyMs: data.latencyMs,
        details: data.details,
      };
    } catch (err: any) {
      return {
        status: 'TALLY_NOT_REACHABLE',
        message: `Failed to probe Tally gateway: ${err.message}`,
      };
    }
  },

  async getCompanyInfo(config: ConnectorConfig): Promise<CompanyInfo> {
    return {
      name: config.tallyCompany || 'TallyPrime Company',
      software: 'TallyPrime',
      currency: 'INR',
    };
  },

  async getAccounts(_config: ConnectorConfig): Promise<MasterEntity[]> {
    return [];
  },

  async getCustomers(_config: ConnectorConfig): Promise<MasterEntity[]> {
    return [];
  },

  async getVendors(_config: ConnectorConfig): Promise<MasterEntity[]> {
    return [];
  },

  async getBalances(_config: ConnectorConfig): Promise<Record<string, number>> {
    return {};
  },

  async getTaxes(_config: ConnectorConfig): Promise<TaxRateInfo[]> {
    return [
      { name: 'CGST', rate: 9, type: 'CGST' },
      { name: 'SGST', rate: 9, type: 'SGST' },
      { name: 'IGST', rate: 18, type: 'IGST' },
    ];
  },

  async getFinancialSummary(_config: ConnectorConfig): Promise<Record<string, any>> {
    return {};
  },

  /**
   * Retrieves accounting transactions from live TallyPrime XML Server
   */
  async getTransactions(config: ConnectorConfig, options?: SyncOptions): Promise<AccountingTransaction[]> {
    const host = config.tallyHost || 'localhost';
    const port = config.tallyPort || 9000;
    const company = config.tallyCompany || options?.clientName || '';

    options?.onLog?.(`Connecting to TallyPrime at ${host}:${port}...`, 'info');

    const res = await fetch('/api/tally/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host,
        port,
        company,
        fromDate: options?.fromDate,
        toDate: options?.toDate,
        fullSync: options?.fullSync,
      }),
    });

    if (!res.ok) {
      throw new Error(`Tally sync API returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    if (!data.success) {
      options?.onLog?.(`Live Tally connection failed: ${data.error}`, 'error');
      throw new Error(data.error || 'Failed to pull data from TallyPrime');
    }

    options?.onLog?.('Tally XML data received. Parsing with canonical Tally parser...', 'info');

    // Parse the retrieved Tally XML using existing parseTallyXmlDoc
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data.xmlData, 'text/xml');
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      throw new Error('Received malformed XML from Tally server.');
    }

    const transactions = parseTallyXmlDoc(xmlDoc, company);

    // Tag client isolation fields
    const enriched = transactions.map((t) => ({
      ...t,
      clientId: options?.clientId,
      clientName: company,
      source: 'LIVE' as const,
    }));

    options?.onLog?.(`Successfully normalized ${enriched.length} transactions from live TallyPrime.`, 'success');
    return enriched;
  },

  /**
   * Existing file parsing fallback (XML / CSV / Excel / JSON)
   */
  async parseFile(
    fileContent: string | ArrayBuffer,
    fileName: string,
    companyName: string
  ): Promise<AccountingTransaction[]> {
    return parseTallyData(fileContent, fileName, companyName);
  },
};
