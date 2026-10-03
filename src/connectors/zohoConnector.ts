import { AccountingTransaction, AccountingSoftware } from '../normalizer/commonModel';
import { parseZohoData } from '../zohoBooks/zohoNormalizer';
import {
  AccountingConnector,
  ConnectorConfig,
  SyncOptions,
  ConnectionTestResult,
  CompanyInfo,
  MasterEntity,
  TaxRateInfo,
} from './accountingConnector';

export const ZohoBooksConnector: AccountingConnector = {
  software: 'Zoho Books',
  name: 'Zoho Books OAuth REST Connector',

  async connect(config: ConnectorConfig): Promise<{ success: boolean; message: string }> {
    const test = await this.testConnection(config);
    return {
      success: test.status === 'CONNECTED',
      message: test.message,
    };
  },

  async disconnect(_config: ConnectorConfig): Promise<void> {
    return Promise.resolve();
  },

  async testConnection(config: ConnectorConfig): Promise<ConnectionTestResult> {
    try {
      const response = await fetch('/api/zoho/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: config.zohoOrgId,
          dataCenter: config.zohoDataCenter || 'in',
          accessToken: config.zohoAccessToken,
        }),
      });

      if (!response.ok) {
        return {
          status: 'FAILED',
          message: `Server returned HTTP ${response.status} while testing Zoho connection.`,
        };
      }

      const data = await response.json();
      return {
        status: data.status,
        message: data.message,
        details: data.details,
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        message: `Failed to probe Zoho Books API: ${err.message}`,
      };
    }
  },

  async getCompanyInfo(config: ConnectorConfig): Promise<CompanyInfo> {
    return {
      name: config.zohoOrgName || 'Zoho Books Organization',
      software: 'Zoho Books',
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
   * Retrieves accounting transactions from live Zoho Books REST API
   */
  async getTransactions(config: ConnectorConfig, options?: SyncOptions): Promise<AccountingTransaction[]> {
    const orgId = config.zohoOrgId || '';
    const company = config.zohoOrgName || options?.clientName || 'Zoho Books Company';

    options?.onLog?.(`Connecting to Zoho Books API for Org ${orgId || 'Active'}...`, 'info');

    const res = await fetch('/api/zoho/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        dataCenter: config.zohoDataCenter || 'in',
        accessToken: config.zohoAccessToken,
        fromDate: options?.fromDate,
        toDate: options?.toDate,
        fullSync: options?.fullSync,
      }),
    });

    if (!res.ok) {
      throw new Error(`Zoho sync API returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    if (!data.success) {
      options?.onLog?.(`Live Zoho API pull failed: ${data.error}`, 'error');
      throw new Error(data.error || 'Failed to pull data from Zoho Books');
    }

    options?.onLog?.(`Received ${data.records?.length || 0} API records from Zoho Books. Normalizing...`, 'info');

    const rawRecords = data.records || [];
    const transactions: AccountingTransaction[] = rawRecords.map((r: any, idx: number) => {
      const invNo = r.invoice_number || r.bill_number || r.journal_number || r.reference_number || `ZB-${idx + 1}`;
      const total = Number(r.total || r.amount || r.bcy_total || 0);
      const taxTotal = Number(r.tax_total || 0);
      const isSales = !!r.invoice_number;
      const isPurchase = !!r.bill_number;

      return {
        id: `zoho-live-${r.invoice_id || r.bill_id || r.journal_id || idx + 1}`,
        date: r.date || new Date().toISOString().slice(0, 10),
        voucherType: isSales ? 'Sales Invoice' : isPurchase ? 'Purchase Bill' : 'Journal',
        voucherNumber: invNo,
        party: r.customer_name || r.vendor_name || 'General Counterparty',
        ledger: isSales ? 'Sales Account' : isPurchase ? 'Purchase Account' : 'General Ledger',
        description: r.notes || r.description || '',
        debit: isPurchase ? total : 0,
        credit: isSales ? total : 0,
        amount: total,
        taxableValue: Math.max(0, total - taxTotal) || total,
        cgst: taxTotal > 0 ? taxTotal / 2 : 0,
        sgst: taxTotal > 0 ? taxTotal / 2 : 0,
        igst: 0,
        gstin: r.gst_no || r.gst_identification_number || '',
        reference: r.reference_number || '',
        sourceSoftware: 'Zoho Books',
        companyName: company,
        clientId: options?.clientId,
        clientName: company,
        source: 'LIVE' as const,
        sourceTransactionId: r.invoice_id || r.bill_id || r.journal_id,
        rawRecord: r,
      };
    });

    options?.onLog?.(`Normalized ${transactions.length} transactions from live Zoho Books.`, 'success');
    return transactions;
  },

  /**
   * Existing file parsing fallback (CSV / Excel / JSON)
   */
  async parseFile(
    fileContent: string | ArrayBuffer,
    fileName: string,
    companyName: string
  ): Promise<AccountingTransaction[]> {
    return parseZohoData(fileContent, fileName, companyName);
  },
};
