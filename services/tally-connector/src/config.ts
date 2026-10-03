import { readFileSync } from 'node:fs';
import path from 'node:path';
import { backendUrl, type AdapterMode, type Company } from '../../../shared/connector/protocol';

export interface ConnectorConfig {
  backendUrl: string;
  dataDir: string;
  adapter: AdapterMode;
  authorizedCompanyIds: string[];
  tallyPort: number;
  requestTimeoutMs: number;
  allowInsecureLoopback: boolean;
  mockAvailable: boolean;
  mockCompanies: Company[];
}
export function readConfig(filename: string): ConnectorConfig {
  const raw = JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  const keys = ['backendUrl','dataDir','adapter','authorizedCompanyIds','tallyPort','requestTimeoutMs','allowInsecureLoopback','mockAvailable','mockCompanies'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !keys.includes(k))) throw new Error('Invalid connector configuration or unknown field');
  if (raw.adapter !== 'mock' && raw.adapter !== 'local') throw new Error('Explicit adapter selection is required');
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 200 && value.every(v => typeof v === 'string' && v.length > 0 && v.length <= 200 && !/[\u0000-\u001f]/.test(v));
  if (!strings(raw.authorizedCompanyIds)) throw new Error('Explicit local company allowlist is required (empty denies all)');
  if (typeof raw.dataDir !== 'string' || !raw.dataDir.trim()) throw new Error('dataDir required');
  if (raw.allowInsecureLoopback !== undefined && typeof raw.allowInsecureLoopback !== 'boolean') throw new Error('Invalid development HTTP option');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Disabling TLS validation is forbidden');
  if (process.env.NODE_ENV === 'production' && raw.allowInsecureLoopback) throw new Error('Development HTTP bypass forbidden in production');
  const tallyPort = raw.tallyPort ?? 9000, timeout = raw.requestTimeoutMs ?? 5000;
  if (!Number.isInteger(tallyPort) || tallyPort < 1 || tallyPort > 65535) throw new Error('Invalid local Tally port');
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 5000) throw new Error('requestTimeoutMs must be 100–5000');
  const mockCompanies = raw.mockCompanies ?? [];
  if (!Array.isArray(mockCompanies) || mockCompanies.length > 200 || mockCompanies.some(c => !c || !strings([c.id, c.name]) || !c.id.startsWith('MOCK:'))) throw new Error('Mock companies must have explicit MOCK: IDs');
  if (new Set(mockCompanies.map(c => c.id)).size !== mockCompanies.length) throw new Error('Duplicate mock company IDs');
  if (raw.mockAvailable !== undefined && typeof raw.mockAvailable !== 'boolean') throw new Error('Invalid mock availability');
  if (raw.adapter === 'local' && (raw.mockAvailable !== undefined || raw.mockCompanies !== undefined)) throw new Error('Local mode cannot contain mock settings');
  return { backendUrl: backendUrl(raw.backendUrl, raw.allowInsecureLoopback === true), dataDir: path.resolve(path.dirname(filename), raw.dataDir), adapter: raw.adapter,
    authorizedCompanyIds: [...new Set(raw.authorizedCompanyIds)] as string[], tallyPort, requestTimeoutMs: timeout,
    allowInsecureLoopback: raw.allowInsecureLoopback === true, mockAvailable: raw.mockAvailable === true, mockCompanies };
}
