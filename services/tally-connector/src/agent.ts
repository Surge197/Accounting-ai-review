import { setTimeout as delay } from 'node:timers/promises';
import { HEARTBEAT_MS, type HeartbeatReply, type Job, type JobResult, type Observation } from '../../../shared/connector/protocol';
import type { ConnectorConfig } from './config';
import type { TallyAdapter } from './adapters';
import { BackendClient, HttpError } from './http';
import { JobJournal, LocalLogger } from './local-state';

export const retryDelay = (failures: number, random = Math.random) => Math.round(Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)) * (0.5 + random() * 0.5));
export class ConnectorAgent {
  private grants: string[] = [];
  private active: Job | null = null;
  constructor(readonly config: ConnectorConfig, readonly adapter: TallyAdapter, readonly client: BackendClient,
    readonly journal: JobJournal, readonly logger: LocalLogger) {}
  private filter(observation: Observation, backendGrants = this.grants): Observation {
    return { ...observation, companies: observation.companies.filter(c => this.config.authorizedCompanyIds.includes(c.id) && backendGrants.includes(c.id)) };
  }
  async tick(signal?: AbortSignal) {
    const observed = await this.adapter.inspect(signal);
    // First heartbeat reports no company metadata until backend permissions are obtained.
    const initialObservation = this.filter(observed);
    const response = await this.client.post<HeartbeatReply>('/heartbeat', { observation: initialObservation }, signal);
    if (!Array.isArray(response.authorizedCompanyIds) || response.authorizedCompanyIds.length > 200 || response.authorizedCompanyIds.some(v => typeof v !== 'string')) throw new Error('Invalid backend permissions');
    this.grants = response.authorizedCompanyIds;
    const authorizedObservation = this.filter(observed);
    if (JSON.stringify(initialObservation.companies) !== JSON.stringify(authorizedObservation.companies)) {
      // Publish newly authorized discovery immediately, including for a one-cycle diagnostic.
      // The backend applies its latest grants again if permissions changed in flight.
      await this.client.post('/heartbeat', { observation: authorizedObservation }, signal);
    }
    this.logger.write('HEARTBEAT_ACCEPTED', { adapter: observed.adapter, tallyStatus: observed.tallyStatus, reason: observed.reason });
    if (!this.active) this.active = (await this.client.post<{ job: Job | null }>('/jobs/claim', {}, signal)).job;
    if (!this.active) return;
    const job = this.active;
    if (!['CHECK_TALLY','DISCOVER_COMPANIES','SYNC_PREFLIGHT'].includes(job.type) || !/^[a-f0-9-]{36}$/.test(job.id) || !/^[A-Za-z0-9_-]{43}$/.test(job.leaseToken)) throw new Error('Unsupported job envelope');
    try {
      await this.client.post(`/jobs/${job.id}/progress`, { leaseToken: job.leaseToken, progress: 10 }, signal);
      const fingerprint = JSON.stringify([job.type, job.companyId, this.config.adapter]);
      let result = this.journal.get(job.id, fingerprint);
      if (job.companyId && (!this.grants.includes(job.companyId) || !this.config.authorizedCompanyIds.includes(job.companyId))) {
        result = { outcome: 'FAILED', code: 'COMPANY_NOT_AUTHORIZED', observation: this.filter(observed), accountingDataSynced: false };
      }
      if (!result) {
        const observation = this.filter(await this.adapter.inspect(signal));
        const available = observation.adapter === 'mock' ? observation.simulatedAvailability === true : observation.tallyStatus === 'AVAILABLE';
        let code: JobResult['code'] = job.type === 'CHECK_TALLY' ? 'CHECKED' : 'DISCOVERED';
        let outcome: JobResult['outcome'] = 'SUCCEEDED';
        if (job.type !== 'CHECK_TALLY' && !available) { outcome = 'FAILED'; code = 'TALLY_UNAVAILABLE'; }
        else if (job.type === 'SYNC_PREFLIGHT') {
          if (!observation.companies.some(c => c.id === job.companyId)) { outcome = 'FAILED'; code = 'COMPANY_UNAVAILABLE'; }
          else code = observation.adapter === 'mock' ? 'MOCK_PREFLIGHT_ONLY' : 'PREFLIGHT_READY';
        }
        result = { outcome, code, observation, accountingDataSynced: false };
        this.journal.put(job.id, fingerprint, result);
      }
      // A stored result is metadata from its original attempt, never proof of current readiness.
      result = { ...result, observation: this.filter(result.observation) };
      await this.client.post(`/jobs/${job.id}/progress`, { leaseToken: job.leaseToken, progress: 100, result }, signal);
      this.logger.write('JOB_FINISHED', { jobId: job.id, code: result.code });
      this.active = null;
    } catch (error) {
      if (error instanceof HttpError && [403,404,409].includes(error.status)) {
        this.logger.write('JOB_LEASE_OR_PERMISSION_LOST', { jobId: job.id, httpStatus: error.status }); this.active = null; return;
      }
      throw error;
    }
  }
  async run(signal: AbortSignal) {
    let failures = 0;
    this.logger.write('AGENT_STARTED', { adapter: this.config.adapter });
    while (!signal.aborted) {
      let wait = HEARTBEAT_MS;
      try { await this.tick(signal); failures = 0; }
      catch (error) {
        if (signal.aborted) break;
        if (error instanceof HttpError && [400,401,403,410].includes(error.status)) {
          this.logger.write('OPERATOR_ACTION_REQUIRED', { httpStatus: error.status }); throw error;
        }
        wait = retryDelay(failures++);
        this.logger.write('BACKEND_RETRY', { retryMs: wait, ...(error instanceof HttpError ? { httpStatus: error.status } : {}) });
      }
      await delay(wait, undefined, { signal }).catch(() => {});
    }
    this.logger.write('AGENT_STOPPED');
  }
}
