import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { fixture } from './helpers';
import { ConnectorStore, secret } from '../../server/connector/store';
import { ConnectorAgent, retryDelay } from '../../services/tally-connector/src/agent';
import { MockTallyAdapter } from '../../services/tally-connector/src/adapters';
import { BackendClient, HttpError } from '../../services/tally-connector/src/http';
import { JobJournal, LocalLogger, acquireLock, loadIdentity, saveIdentity } from '../../services/tally-connector/src/local-state';
import { readConfig, type ConnectorConfig } from '../../services/tally-connector/src/config';
import { LEASE_MS, type JobResult } from '../../shared/connector/protocol';
import { mountConnector } from '../../server/connector/mount';

test('agent completes authorized mock preflight; journal survives restart and prevents repeat execution after lost upload', async () => {
  let now = 1_000_000;
  const f = await fixture(new ConnectorStore(':memory:', () => now));
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tally-agent-test-'));
  let journal = new JobJournal(dir);
  try {
    const a = await f.pair();
    const config: ConnectorConfig = { backendUrl: f.origin, dataDir: dir, adapter: 'mock', authorizedCompanyIds: ['MOCK:alpha'], tallyPort: 9000, requestTimeoutMs: 500, allowInsecureLoopback: true, mockAvailable: true, mockCompanies: [] };
    let inspections = 0;
    const mock = new MockTallyAdapter(true, [{ id: 'MOCK:alpha', name: 'MOCK A' }, { id: 'forbidden', name: 'Hidden' }]);
    const adapter = { async inspect() { inspections++; return mock.inspect(); } };
    class DroppedUploadClient extends BackendClient {
      failUpload = true;
      override async post<T>(endpoint: string, body: any, signal?: AbortSignal): Promise<T> {
        if (body.result && this.failUpload) { this.failUpload = false; throw new Error('Simulated offline upload'); }
        return super.post(endpoint, body, signal);
      }
    }
    const client = new DroppedUploadClient(f.origin, a.credential, 1000), logger = new LocalLogger(path.join(dir, 'logs'));
    const job = f.store.enqueue(a.id, 'SYNC_PREFLIGHT', 'MOCK:alpha', 'run-once');
    const first = new ConnectorAgent(config, adapter, client, journal, logger);
    await assert.rejects(first.tick(), /Simulated offline/);
    assert.equal(inspections, 2); assert.equal(f.store.viewJob(job.id).state, 'RUNNING');
    journal.close(); journal = new JobJournal(dir); now += LEASE_MS;
    const restarted = new ConnectorAgent(config, adapter, new BackendClient(f.origin, a.credential), journal, logger);
    await restarted.tick();
    assert.equal(inspections, 3, 'Restart only probes heartbeat; completed job work is not repeated');
    const result = f.store.viewJob(job.id).result!;
    assert.equal(result.code, 'MOCK_PREFLIGHT_ONLY'); assert.equal(result.accountingDataSynced, false); assert.equal(result.observation.tallyStatus, 'NOT_AVAILABLE');
    assert.deepEqual(result.observation.companies.map(c => c.id), ['MOCK:alpha']);
    await restarted.tick(); assert.equal(f.store.viewAgent(a.id).lastObservation?.companies.length, 1);
    assert.equal(f.store.viewJob(job.id).attempt, 2);
    assert.ok(!readFileSync(path.join(dir, 'logs/connector.log'), 'utf8').includes(a.credential));
    config.authorizedCompanyIds = [];
    const denied = f.store.enqueue(a.id, 'SYNC_PREFLIGHT', 'MOCK:alpha', 'local-deny'); await restarted.tick();
    assert.equal(f.store.viewJob(denied.id).result?.code, 'COMPANY_NOT_AUTHORIZED');
  } finally { journal.close(); await f.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('retry bounds, structured log rotation and singleton lock', () => {
  assert.equal(retryDelay(0, () => 0), 500); assert.equal(retryDelay(100, () => 1), 30_000);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tally-state-test-'));
  try {
    const release = acquireLock(dir); assert.throws(() => acquireLock(dir), /running/); release(); const again = acquireLock(dir); again();
    const log = new LocalLogger(path.join(dir, 'logs'), 100);
    for (let i = 0; i < 30; i++) log.write('TEST_EVENT', { code: 'TEST' });
    assert.equal(readdirSync(path.join(dir, 'logs')).length, 5);
    for (const file of readdirSync(path.join(dir, 'logs'))) for (const line of readFileSync(path.join(dir, 'logs', file), 'utf8').trim().split('\n')) assert.equal(JSON.parse(line).event, 'TEST_EVENT');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Windows DPAPI protects identity at rest and round-trips without plaintext token', { skip: process.platform !== 'win32' }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tally-dpapi-test-'));
  try {
    const identity = { agentId: 'test-agent', credential: secret(), backendUrl: 'https://example.com', adapter: 'mock' as const, registered: true };
    saveIdentity(dir, identity); assert.deepEqual(loadIdentity(dir), identity);
    assert.ok(!readFileSync(path.join(dir, 'identity.dpapi'), 'utf8').includes(identity.credential));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('configuration denies arbitrary hosts, implicit mocks, wildcard grants, remote HTTP and mixed adapters', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tally-config-test-')), file = path.join(dir, 'config.json');
  const base = { backendUrl: 'https://example.com', dataDir: './state', adapter: 'local', authorizedCompanyIds: [] };
  try {
    writeFileSync(file, '\uFEFF' + JSON.stringify(base)); assert.equal(readConfig(file).tallyPort, 9000);
    for (const raw of [{ ...base, tallyHost: 'evil' }, { ...base, adapter: undefined }, { ...base, authorizedCompanyIds: '*' }, { ...base, backendUrl: 'http://example.com', allowInsecureLoopback: true }, { ...base, mockAvailable: true }]) {
      writeFileSync(file, JSON.stringify(raw)); assert.throws(() => readConfig(file));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('legacy direct Tally routes always return 410 and never contact supplied destination', async () => {
  const app = express(); mountConnector(app, {}); app.use(express.json());
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (const endpoint of ['test-connection','pull-data']) {
      const response = await fetch(`${origin}/api/tally/${endpoint}`, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ host: '169.254.169.254', port: 80 }) });
      assert.equal(response.status, 410); assert.equal((await response.json() as any).code, 'CONNECTOR_REQUIRED');
    }
    assert.equal((await fetch(`${origin}/api/connector/v1/heartbeat`, { method: 'POST' })).status, 503);
    const source = readFileSync('server.ts', 'utf8'); assert.ok(!source.includes('fetch(tallyUrl')); assert.ok(!source.includes('runtimeConfig.tallyHost'));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('backend redirects do not forward the agent credential', async () => {
  const app = express(); app.use((_req, res) => { res.redirect('https://example.com'); });
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const client = new BackendClient(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, secret());
    await assert.rejects(client.post('/heartbeat', {}));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
