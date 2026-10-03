export const PROTOCOL_VERSION = 1;
export const HEARTBEAT_MS = 15_000;
export const OFFLINE_MS = 60_000;
export const LEASE_MS = 60_000;
export const JOB_TYPES = ['CHECK_TALLY', 'DISCOVER_COMPANIES', 'SYNC_PREFLIGHT'] as const;
export type JobType = typeof JOB_TYPES[number];
export type AdapterMode = 'mock' | 'local';
export interface Company { id: string; name: string }
export interface Observation {
  adapter: AdapterMode;
  tallyStatus: 'AVAILABLE' | 'NOT_AVAILABLE';
  reason: 'OK' | 'MOCK_MODE' | 'CONNECTION_FAILED' | 'INVALID_RESPONSE';
  simulatedAvailability?: boolean;
  companies: Company[];
}
export interface Job {
  id: string;
  type: JobType;
  companyId: string | null;
  leaseToken: string;
  leaseExpiresAt: number;
  attempt: number;
}
export interface JobResult {
  outcome: 'SUCCEEDED' | 'FAILED';
  code: 'CHECKED' | 'DISCOVERED' | 'PREFLIGHT_READY' | 'MOCK_PREFLIGHT_ONLY' | 'TALLY_UNAVAILABLE' | 'COMPANY_UNAVAILABLE' | 'COMPANY_NOT_AUTHORIZED';
  observation: Observation;
  accountingDataSynced: false;
}
export interface HeartbeatReply { authorizedCompanyIds: string[]; heartbeatMs: number }

export function backendUrl(value: string, allowInsecureLoopback = false): string {
  const url = new URL(value);
  const loopback = ['127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Backend URL must be an origin without credentials, path, query or fragment');
  if (url.protocol !== 'https:' && !(allowInsecureLoopback && loopback && url.protocol === 'http:')) throw new Error('Backend requires HTTPS (HTTP is permitted only for explicitly enabled numeric loopback development)');
  return url.origin;
}
