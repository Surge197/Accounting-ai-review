import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { LEASE_MS, OFFLINE_MS, type AdapterMode, type Observation, type JobType, type JobResult } from '../../shared/connector/protocol';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export const sameSecret = (left: string, right: string) => timingSafeEqual(Buffer.from(hash(left)), Buffer.from(hash(right)));
export interface AgentRow {
  id: string; tenant_id: string; label: string; adapter: AdapterMode; grants: string;
  token_hash: string; token_expires_at: number; created_at: number; last_seen_at: number | null;
  revoked_at: number | null; observation: string | null;
}
export interface JobRow {
  id: string; agent_id: string; idempotency_key: string; type: JobType; company_id: string | null;
  state: string; progress: number; attempt: number; lease_token: string | null;
  lease_expires_at: number | null; result: string | null; created_at: number; updated_at: number;
}
export class ConnectorStore {
  readonly db: DatabaseSync;
  constructor(filename: string, readonly now = Date.now) {
    if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  }
  close() { this.db.close(); }
  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = work(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  audit(event: string, agentId: string | null, detail = '') {
    this.db.prepare('INSERT INTO connector_audit(at,event,agent_id,detail) VALUES(?,?,?,?)').run(this.now(), event, agentId, detail);
  }
  createPairing(tenant: string, label: string, adapter: AdapterMode, grants: string[]) {
    const token = secret(), expiresAt = this.now() + 10 * 60_000;
    this.transaction(() => {
      this.db.prepare('INSERT INTO connector_pairings VALUES(?,?,?,?,?,?,NULL)').run(hash(token), tenant, label, adapter, JSON.stringify(grants), expiresAt);
      this.audit('PAIRING_CREATED', null, tenant);
    });
    return { pairingToken: token, expiresAt };
  }
  register(pairingToken: string, id: string, credential: string, adapter: AdapterMode) {
    return this.transaction(() => {
      const pair = this.db.prepare('SELECT * FROM connector_pairings WHERE token_hash=?').get(hash(pairingToken)) as any;
      if (!pair || pair.expires_at <= this.now() || pair.adapter !== adapter) throw new ApiError(401, 'Pairing invalid or expired');
      const existing = this.db.prepare('SELECT * FROM connector_agents WHERE id=?').get(id) as unknown as AgentRow | undefined;
      // Lost registration responses can be retried only by the original credential and pairing, before expiry.
      if (pair.used_by) {
        if (pair.used_by === id && existing && existing.token_hash === hash(credential) && !existing.revoked_at && existing.token_expires_at > this.now()) return { agentId: id, tokenExpiresAt: existing.token_expires_at };
        throw new ApiError(409, 'Pairing already consumed');
      }
      if (existing) throw new ApiError(409, 'Agent already exists');
      const expiresAt = this.now() + 90 * 24 * 60 * 60_000;
      this.db.prepare(`INSERT INTO connector_agents(id,tenant_id,label,adapter,grants,token_hash,token_expires_at,created_at)
        VALUES(?,?,?,?,?,?,?,?)`).run(id, pair.tenant_id, pair.label, adapter, pair.grants, hash(credential), expiresAt, this.now());
      this.db.prepare('UPDATE connector_pairings SET used_by=? WHERE token_hash=?').run(id, hash(pairingToken));
      this.audit('AGENT_REGISTERED', id);
      return { agentId: id, tokenExpiresAt: expiresAt };
    });
  }
  authenticate(credential: string): AgentRow {
    const agent = this.db.prepare('SELECT * FROM connector_agents WHERE token_hash=?').get(hash(credential)) as unknown as AgentRow | undefined;
    if (!agent || agent.revoked_at !== null || agent.token_expires_at <= this.now()) throw new ApiError(401, 'Agent credential invalid, expired or revoked');
    return agent;
  }
  getAgent(id: string): AgentRow {
    const agent = this.db.prepare('SELECT * FROM connector_agents WHERE id=?').get(id) as unknown as AgentRow | undefined;
    if (!agent) throw new ApiError(404, 'Agent not found');
    return agent;
  }
  viewAgent(id: string) {
    const a = this.getAgent(id);
    const online = a.revoked_at === null && a.token_expires_at > this.now() && a.last_seen_at !== null && this.now() - a.last_seen_at < OFFLINE_MS;
    const observation: Observation | null = a.observation ? JSON.parse(a.observation) : null;
    const grants: string[] = JSON.parse(a.grants);
    if (observation) observation.companies = observation.companies.filter(c => grants.includes(c.id));
    return { id: a.id, tenantId: a.tenant_id, label: a.label, adapter: a.adapter, authorizedCompanyIds: grants,
      status: online ? 'ONLINE' : 'OFFLINE', revoked: a.revoked_at !== null, lastSeenAt: a.last_seen_at,
      tallyStatus: online ? observation?.tallyStatus ?? 'UNKNOWN' : 'UNKNOWN',
      observationStale: !online, lastObservation: observation, tokenExpiresAt: a.token_expires_at };
  }
  heartbeat(agent: AgentRow, observation: Observation) {
    observation.companies = observation.companies.filter(c => (JSON.parse(agent.grants) as string[]).includes(c.id));
    this.db.prepare('UPDATE connector_agents SET last_seen_at=?,observation=? WHERE id=?').run(this.now(), JSON.stringify(observation), agent.id);
  }
  setGrants(id: string, grants: string[]) {
    this.getAgent(id);
    this.transaction(() => {
      this.db.prepare('UPDATE connector_agents SET grants=? WHERE id=?').run(JSON.stringify(grants), id);
      this.audit('GRANTS_REPLACED', id);
    });
  }
  revoke(id: string) {
    this.getAgent(id);
    this.transaction(() => {
      this.db.prepare('UPDATE connector_agents SET revoked_at=? WHERE id=?').run(this.now(), id);
      this.db.prepare("UPDATE connector_jobs SET state='FAILED',updated_at=? WHERE agent_id=? AND state IN ('QUEUED','RUNNING')").run(this.now(), id);
      this.audit('AGENT_REVOKED', id);
    });
  }
  enqueue(id: string, type: JobType, companyId: string | null, key: string) {
    return this.transaction(() => {
      const agent = this.getAgent(id);
      if (agent.revoked_at !== null || agent.token_expires_at <= this.now()) throw new ApiError(409, 'Agent requires pairing');
      if (companyId && !(JSON.parse(agent.grants) as string[]).includes(companyId)) throw new ApiError(403, 'Company not authorized');
      const existing = this.db.prepare('SELECT * FROM connector_jobs WHERE agent_id=? AND idempotency_key=?').get(id, key) as unknown as JobRow | undefined;
      if (existing) {
        if (existing.type !== type || existing.company_id !== companyId) throw new ApiError(409, 'Idempotency key has a different payload');
        return this.viewJob(existing.id);
      }
      const jobId = randomUUID();
      this.db.prepare('INSERT INTO connector_jobs(id,agent_id,idempotency_key,type,company_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(jobId, id, key, type, companyId, this.now(), this.now());
      this.audit('JOB_CREATED', id, jobId);
      return this.viewJob(jobId);
    });
  }
  viewJob(id: string) {
    const row = this.db.prepare('SELECT * FROM connector_jobs WHERE id=?').get(id) as unknown as JobRow | undefined;
    if (!row) throw new ApiError(404, 'Job not found');
    const { lease_token, result, ...safe } = row;
    const parsed: JobResult | null = result ? JSON.parse(result) : null;
    if (parsed) parsed.observation.companies = parsed.observation.companies.filter(c => JSON.parse(this.getAgent(row.agent_id).grants).includes(c.id));
    return { ...safe, result: parsed };
  }
  claim(agent: AgentRow) {
    return this.transaction(() => {
      // Only one active lease per agent. Expired jobs have bounded redelivery.
      if (this.db.prepare("SELECT id FROM connector_jobs WHERE agent_id=? AND state='RUNNING' AND lease_expires_at>?").get(agent.id, this.now())) return null;
      this.db.prepare("UPDATE connector_jobs SET state='FAILED',updated_at=? WHERE agent_id=? AND state='RUNNING' AND lease_expires_at<=? AND attempt>=3").run(this.now(), agent.id, this.now());
      const candidates = this.db.prepare("SELECT * FROM connector_jobs WHERE agent_id=? AND (state='QUEUED' OR (state='RUNNING' AND lease_expires_at<=?)) ORDER BY created_at,id").all(agent.id, this.now()) as unknown as JobRow[];
      for (const row of candidates) {
        if (row.company_id && !JSON.parse(agent.grants).includes(row.company_id)) {
          this.db.prepare("UPDATE connector_jobs SET state='FAILED',updated_at=? WHERE id=?").run(this.now(), row.id);
          this.audit('JOB_AUTHORIZATION_REMOVED', agent.id, row.id);
          continue;
        }
        const token = secret(), expiresAt = this.now() + LEASE_MS;
        this.db.prepare("UPDATE connector_jobs SET state='RUNNING',attempt=attempt+1,progress=0,lease_token=?,lease_expires_at=?,updated_at=? WHERE id=?").run(token, expiresAt, this.now(), row.id);
        this.audit('JOB_CLAIMED', agent.id, row.id);
        return { id: row.id, type: row.type, companyId: row.company_id, leaseToken: token, leaseExpiresAt: expiresAt, attempt: row.attempt + 1 };
      }
      return null;
    });
  }
  report(agent: AgentRow, id: string, leaseToken: string, progress: number, result?: JobResult) {
    return this.transaction(() => {
      const job = this.db.prepare('SELECT * FROM connector_jobs WHERE id=? AND agent_id=?').get(id, agent.id) as unknown as JobRow | undefined;
      if (!job) throw new ApiError(404, 'Job not found');
      if (job.lease_token !== leaseToken) throw new ApiError(409, 'Lease lost');
      if (job.company_id && !JSON.parse(agent.grants).includes(job.company_id)) throw new ApiError(403, 'Company authorization removed');
      if (result) {
        result.observation.companies = result.observation.companies.filter(c => JSON.parse(agent.grants).includes(c.id));
        const successCodes: Record<JobType, string[]> = { CHECK_TALLY: ['CHECKED'], DISCOVER_COMPANIES: ['DISCOVERED'], SYNC_PREFLIGHT: ['PREFLIGHT_READY','MOCK_PREFLIGHT_ONLY'] };
        if (result.outcome === 'SUCCEEDED') {
          if (!successCodes[job.type].includes(result.code)) throw new ApiError(400, 'Result code does not match job type');
          const available = result.observation.adapter === 'mock' ? result.observation.simulatedAvailability === true : result.observation.tallyStatus === 'AVAILABLE';
          if (job.type !== 'CHECK_TALLY' && !available) throw new ApiError(400, 'Result requires an available adapter');
          if (job.type === 'SYNC_PREFLIGHT') {
            if (!result.observation.companies.some(c => c.id === job.company_id)) throw new ApiError(400, 'Preflight company is absent');
            if ((result.code === 'MOCK_PREFLIGHT_ONLY') !== (agent.adapter === 'mock')) throw new ApiError(400, 'Preflight mode mismatch');
          }
        } else if (!['TALLY_UNAVAILABLE','COMPANY_UNAVAILABLE','COMPANY_NOT_AUTHORIZED'].includes(result.code)) throw new ApiError(400, 'Invalid failure code');
      }
      if (job.state === 'SUCCEEDED' || job.state === 'FAILED') {
        if (result && job.result === JSON.stringify(result)) return this.viewJob(id);
        throw new ApiError(409, 'Job already finished');
      }
      if (job.state !== 'RUNNING' || (job.lease_expires_at ?? 0) <= this.now()) throw new ApiError(409, 'Lease expired');
      if (progress < job.progress) throw new ApiError(409, 'Progress must be monotonic');
      this.db.prepare('UPDATE connector_jobs SET progress=?,state=?,result=?,lease_expires_at=?,updated_at=? WHERE id=?').run(result ? 100 : progress, result?.outcome ?? 'RUNNING', result ? JSON.stringify(result) : null, this.now() + LEASE_MS, this.now(), id);
      if (result) this.audit('JOB_FINISHED', agent.id, id);
      return this.viewJob(id);
    });
  }
}
