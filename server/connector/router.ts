import express, { type Request, type Response, type NextFunction } from 'express';
import { ApiError, ConnectorStore, sameSecret, type AgentRow } from './store';
import { HEARTBEAT_MS, JOB_TYPES, PROTOCOL_VERSION, type Observation, type JobResult } from '../../shared/connector/protocol';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Expected object');
  return value as Record<string, unknown>;
}
function exact(value: unknown, keys: string[]) {
  const body = object(value);
  if (Object.keys(body).some(key => !keys.includes(key))) throw new ApiError(400, 'Unexpected field');
  return body;
}
function string(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new ApiError(400, 'Invalid string');
  return value;
}
function token(value: unknown) {
  const result = string(value, 43);
  if (!/^[A-Za-z0-9_-]{43}$/.test(result)) throw new ApiError(400, 'Expected 256-bit credential');
  return result;
}
function ids(value: unknown) {
  if (!Array.isArray(value) || value.length > 200) throw new ApiError(400, 'Expected at most 200 company IDs');
  return [...new Set(value.map(v => string(v)))];
}
function mode(value: unknown): 'mock' | 'local' {
  if (value !== 'mock' && value !== 'local') throw new ApiError(400, 'Expected explicit adapter mode');
  return value;
}
function observation(value: unknown, agent: AgentRow): Observation {
  const b = exact(value, ['adapter', 'tallyStatus', 'reason', 'simulatedAvailability', 'companies']);
  if (b.adapter !== agent.adapter) throw new ApiError(400, 'Adapter does not match pairing');
  if (b.tallyStatus !== 'AVAILABLE' && b.tallyStatus !== 'NOT_AVAILABLE') throw new ApiError(400, 'Invalid Tally status');
  if (!['OK', 'MOCK_MODE', 'CONNECTION_FAILED', 'INVALID_RESPONSE'].includes(b.reason as string)) throw new ApiError(400, 'Invalid reason');
  if (agent.adapter === 'mock') {
    if (b.tallyStatus !== 'NOT_AVAILABLE' || b.reason !== 'MOCK_MODE' || typeof b.simulatedAvailability !== 'boolean') throw new ApiError(400, 'Mock cannot claim real Tally availability');
  } else if (b.simulatedAvailability !== undefined || b.reason === 'MOCK_MODE' || (b.tallyStatus === 'AVAILABLE') !== (b.reason === 'OK')) throw new ApiError(400, 'Inconsistent local status');
  if (!Array.isArray(b.companies) || b.companies.length > 200) throw new ApiError(400, 'Invalid inventory');
  const companies = b.companies.map(v => { const c = exact(v, ['id','name']); return { id: string(c.id), name: string(c.name) }; });
  if ((agent.adapter === 'local' && b.tallyStatus === 'NOT_AVAILABLE' || agent.adapter === 'mock' && !b.simulatedAvailability) && companies.length) throw new ApiError(400, 'Unavailable adapter cannot report loaded companies');
  if (new Set(companies.map(c => c.id)).size !== companies.length) throw new ApiError(400, 'Duplicate company ID');
  return { adapter: agent.adapter, tallyStatus: b.tallyStatus, reason: b.reason as Observation['reason'], ...(agent.adapter === 'mock' ? { simulatedAvailability: b.simulatedAvailability as boolean } : {}), companies };
}
export interface RouterOptions { adminToken: string; allowInsecureLoopback?: boolean }
export function connectorRouter(store: ConnectorStore, options: RouterOptions) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(options.adminToken)) throw new Error('CONNECTOR_ADMIN_TOKEN must be a 32–256 character random base64url secret');
  const router = express.Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const remote = req.socket.remoteAddress;
    const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    if (!req.secure && !(options.allowInsecureLoopback && loopback)) return res.status(403).json({ error: 'HTTPS required' });
    next();
  });
  // Fixed-size per-peer limiter: trust proxy is configured only by backend deployment, never by payloads.
  const buckets = new Map<string, { count: number; until: number }>();
  router.use((req, res, next) => {
    const now = Date.now(), key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    for (const [ip, bucket] of buckets) if (bucket.until < now) buckets.delete(ip);
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 5000) return res.status(429).json({ error: 'Rate limit' });
      bucket = { count: 0, until: now + 60_000 }; buckets.set(key, bucket);
    }
    if (++bucket.count > 240) return res.status(429).setHeader('Retry-After', '60').json({ error: 'Rate limit' });
    next();
  });
  router.use(express.json({ limit: '64kb', strict: true }));
  function bearer(req: Request) {
    const header = req.get('authorization') ?? '';
    if (!/^Bearer [A-Za-z0-9_-]{32,256}$/.test(header)) throw new ApiError(401, 'Bearer credential required');
    return header.slice(7);
  }
  const admin = (req: Request, _res: Response, next: NextFunction) => {
    try { if (!sameSecret(bearer(req), options.adminToken)) throw new ApiError(401, 'Operator credential invalid'); next(); } catch (err) { next(err); }
  };
  const auth = (req: Request, res: Response, next: NextFunction) => {
    try { res.locals.agent = store.authenticate(bearer(req)); next(); } catch (err) { next(err); }
  };
  router.post('/register', (req, res) => {
    const b = exact(req.body, ['protocolVersion','pairingToken','agentId','credential','adapter']);
    if (b.protocolVersion !== PROTOCOL_VERSION) throw new ApiError(400, 'Protocol version unsupported');
    const id = string(b.agentId, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new ApiError(400, 'Agent ID must be UUID v4');
    res.status(201).json(store.register(token(b.pairingToken), id, token(b.credential), mode(b.adapter)));
  });
  router.post('/admin/pairings', admin, (req, res) => {
    const b = exact(req.body, ['tenantId','label','adapter','authorizedCompanyIds']);
    res.status(201).json(store.createPairing(string(b.tenantId), string(b.label), mode(b.adapter), ids(b.authorizedCompanyIds)));
  });
  router.get('/admin/agents', admin, (_req, res) => {
    const rows = store.db.prepare('SELECT id FROM connector_agents ORDER BY created_at DESC LIMIT 500').all();
    res.json({ agents: rows.map(row => store.viewAgent(row.id as string)) });
  });
  router.get('/admin/agents/:id', admin, (req, res) => { res.json(store.viewAgent(req.params.id as string)); });
  router.put('/admin/agents/:id/companies', admin, (req, res) => {
    const b = exact(req.body, ['authorizedCompanyIds']);
    store.setGrants(req.params.id as string, ids(b.authorizedCompanyIds)); res.json(store.viewAgent(req.params.id as string));
  });
  router.post('/admin/agents/:id/revoke', admin, (req, res) => {
    exact(req.body, []); store.revoke(req.params.id as string); res.json({ revoked: true });
  });
  router.post('/admin/agents/:id/jobs', admin, (req, res) => {
    const b = exact(req.body, ['type','companyId','idempotencyKey']);
    if (b.type === 'SYNC_ACCOUNTING') throw new ApiError(501, 'Accounting synchronization is not implemented');
    if (!JOB_TYPES.includes(b.type as any)) throw new ApiError(400, 'Unsupported job type');
    const company = b.type === 'SYNC_PREFLIGHT' ? string(b.companyId) : null;
    if (company === null && b.companyId != null) throw new ApiError(400, 'This job has no company parameter');
    res.status(201).json(store.enqueue(req.params.id as string, b.type as any, company, string(b.idempotencyKey, 100)));
  });
  router.get('/admin/jobs/:id', admin, (req, res) => { res.json(store.viewJob(req.params.id as string)); });
  router.post('/heartbeat', auth, (req, res) => {
    const b = exact(req.body, ['observation']); const agent = res.locals.agent as AgentRow;
    store.heartbeat(agent, observation(b.observation, agent));
    res.json({ heartbeatMs: HEARTBEAT_MS, authorizedCompanyIds: JSON.parse(agent.grants) });
  });
  router.post('/jobs/claim', auth, (req, res) => { exact(req.body, []); res.json({ job: store.claim(res.locals.agent) }); });
  router.post('/jobs/:id/progress', auth, (req, res) => {
    const b = exact(req.body, ['leaseToken','progress','result']);
    if (!Number.isInteger(b.progress) || (b.progress as number) < 0 || (b.progress as number) > 100) throw new ApiError(400, 'Invalid progress');
    let result: JobResult | undefined;
    if (b.result !== undefined) {
      const r = exact(b.result, ['outcome','code','observation','accountingDataSynced']);
      if (!['SUCCEEDED','FAILED'].includes(r.outcome as string) || r.accountingDataSynced !== false || b.progress !== 100) throw new ApiError(400, 'Invalid foundation result');
      const codes = ['CHECKED','DISCOVERED','PREFLIGHT_READY','MOCK_PREFLIGHT_ONLY','TALLY_UNAVAILABLE','COMPANY_UNAVAILABLE','COMPANY_NOT_AUTHORIZED'];
      if (!codes.includes(r.code as string)) throw new ApiError(400, 'Invalid result code');
      const obs = observation(r.observation, res.locals.agent);
      if (r.code === 'PREFLIGHT_READY' && (obs.adapter !== 'local' || obs.tallyStatus !== 'AVAILABLE')) throw new ApiError(400, 'Real readiness requires local Tally');
      result = { outcome: r.outcome as JobResult['outcome'], code: r.code as JobResult['code'], observation: obs, accountingDataSynced: false };
    }
    res.json(store.report(res.locals.agent, req.params.id as string, token(b.leaseToken), b.progress as number, result));
  });
  router.use((_req, res) => { res.status(404).json({ error: 'Connector endpoint not found' }); });
  router.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof ApiError ? error.status : error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    if (status === 500) console.error('Connector backend request failed'); // Never log request bodies/credentials.
    res.status(status).json({ error: error instanceof ApiError ? error.message : status === 500 ? 'Connector backend error' : 'Invalid request body' });
  });
  return router;
}
