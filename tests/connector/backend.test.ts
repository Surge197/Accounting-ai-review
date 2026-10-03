import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConnectorStore, secret, hash } from '../../server/connector/store';
import { fixture, mockObservation } from './helpers';
import { LEASE_MS, OFFLINE_MS, backendUrl } from '../../shared/connector/protocol';

test('HTTPS is enforced, forwarded headers are not trusted by default, HTTP only explicit numeric loopback', async () => {
  const f = await fixture(undefined, false);
  try {
    assert.equal((await f.request('/admin/agents')).status, 403);
    const spoof = await fetch(`${f.origin}/api/connector/v1/admin/agents`, { headers: { 'x-forwarded-proto': 'https', authorization: `Bearer ${f.admin}` } });
    assert.equal(spoof.status, 403);
    for (const url of ['http://example.com','http://localhost','https://user:pass@example.com','https://example.com/path','https://example.com?x=1']) assert.throws(() => backendUrl(url, true));
    assert.equal(backendUrl('http://127.0.0.1:3000', true), 'http://127.0.0.1:3000');
    assert.throws(() => backendUrl('http://127.0.0.1:3000'));
  } finally { await f.close(); }
});

test('secure pairing is single-use, expiry-bound, hashed and safely retryable after a lost response', async () => {
  let now = 1_000_000;
  const f = await fixture(new ConnectorStore(':memory:', () => now));
  try {
    assert.equal((await f.request('/admin/pairings', {}, secret())).status, 401);
    const a = await f.pair(); assert.equal(a.registration.status, 201);
    assert.equal((await f.request('/register', a.payload)).body.agentId, a.id);
    assert.equal((await f.request('/register', { ...a.payload, agentId: randomUUID(), credential: secret() })).status, 409);
    assert.equal((await f.request('/register', { ...a.payload, adapter: 'local' })).status, 401);
    assert.equal((await f.request('/register', { ...a.payload, tenantId: 'forged' })).status, 400);
    const agent = f.store.getAgent(a.id); assert.equal(agent.token_hash, hash(a.credential));
    assert.ok(!JSON.stringify(f.store.viewAgent(a.id)).includes(a.credential));
    now += 10 * 60_000;
    assert.equal((await f.request('/register', a.payload)).status, 401);
    assert.equal((await f.request('/register', { ...a.payload, pairingToken: secret() })).status, 401);
    now = agent.token_expires_at;
    assert.equal((await f.request('/heartbeat', { observation: mockObservation }, a.credential)).status, 401);
  } finally { await f.close(); }
});

test('heartbeat separates agent, Tally, mock and stale states; grants filter inventory; revocation is immediate', async () => {
  let now = 1_000_000;
  const f = await fixture(new ConnectorStore(':memory:', () => now));
  try {
    const a = await f.pair();
    assert.equal(f.store.viewAgent(a.id).status, 'OFFLINE');
    const obs = { ...mockObservation, companies: [...mockObservation.companies, { id: 'forbidden', name: 'Hidden' }] };
    assert.equal((await f.request('/heartbeat', { observation: obs }, a.credential)).status, 200);
    assert.equal(f.store.viewAgent(a.id).status, 'ONLINE');
    assert.equal(f.store.viewAgent(a.id).tallyStatus, 'NOT_AVAILABLE');
    assert.equal(f.store.viewAgent(a.id).lastObservation?.companies.length, 1);
    assert.equal((await f.request('/heartbeat', { observation: { ...obs, tallyStatus: 'AVAILABLE' } }, a.credential)).status, 400);
    now += OFFLINE_MS;
    assert.equal(f.store.viewAgent(a.id).status, 'OFFLINE'); assert.equal(f.store.viewAgent(a.id).tallyStatus, 'UNKNOWN');
    assert.equal(f.store.viewAgent(a.id).observationStale, true);
    assert.equal((await f.request('/admin/agents')).status, 200);
    assert.equal((await f.request('/admin/agents', undefined, a.credential)).status, 401);
    await f.request(`/admin/agents/${a.id}/revoke`, {});
    assert.equal((await f.request('/heartbeat', { observation: obs }, a.credential)).status, 401);
    assert.equal((await f.request('/register', a.payload)).status, 409);
  } finally { await f.close(); }
});

test('job authorization, idempotency, leases, duplicate reports and cross-agent isolation', async () => {
  let now = 1_000_000;
  const f = await fixture(new ConnectorStore(':memory:', () => now));
  try {
    const a = await f.pair(), other = await f.pair('mock', ['MOCK:alpha'], 'tenant-b');
    const endpoint = `/admin/agents/${a.id}/jobs`;
    const payload = { type: 'SYNC_PREFLIGHT', companyId: 'MOCK:alpha', idempotencyKey: 'job-1' };
    const create = await f.request(endpoint, payload); assert.equal(create.status, 201);
    assert.equal((await f.request(endpoint, payload)).body.id, create.body.id);
    assert.equal((await f.request(endpoint, { type: 'CHECK_TALLY', idempotencyKey: 'job-1' })).status, 409);
    assert.equal((await f.request(endpoint, { ...payload, companyId: 'forbidden', idempotencyKey: 'job-2' })).status, 403);
    assert.equal((await f.request(endpoint, { ...payload, host: '169.254.169.254' })).status, 400);
    assert.equal((await f.request(endpoint, { ...payload, type: 'SYNC_ACCOUNTING' })).status, 501);
    assert.equal((await f.request('/jobs/claim', {}, other.credential)).body.job, null);
    const claim = (await f.request('/jobs/claim', {}, a.credential)).body.job;
    assert.equal((await f.request('/jobs/claim', {}, a.credential)).body.job, null);
    const reportUrl = `/jobs/${claim.id}/progress`;
    assert.equal((await f.request(reportUrl, { leaseToken: claim.leaseToken, progress: 10 }, other.credential)).status, 404);
    assert.equal((await f.request(reportUrl, { leaseToken: claim.leaseToken, progress: 10 }, a.credential)).status, 200);
    assert.equal((await f.request(reportUrl, { leaseToken: claim.leaseToken, progress: 5 }, a.credential)).status, 409);
    now += LEASE_MS;
    assert.equal((await f.request(reportUrl, { leaseToken: claim.leaseToken, progress: 20 }, a.credential)).status, 409);
    const retry = (await f.request('/jobs/claim', {}, a.credential)).body.job;
    assert.equal(retry.id, claim.id); assert.equal(retry.attempt, 2); assert.notEqual(retry.leaseToken, claim.leaseToken);
    assert.equal((await f.request(reportUrl, { leaseToken: claim.leaseToken, progress: 20 }, a.credential)).status, 409);
    const body = { leaseToken: retry.leaseToken, progress: 100, result: { outcome: 'SUCCEEDED', code: 'MOCK_PREFLIGHT_ONLY', observation: mockObservation, accountingDataSynced: false } };
    assert.equal((await f.request(reportUrl, body, a.credential)).status, 200);
    assert.equal((await f.request(reportUrl, body, a.credential)).status, 200);
    assert.equal((await f.request('/jobs/claim', {}, a.credential)).body.job, null);
    assert.equal(f.store.viewJob(claim.id).progress, 100);
  } finally { await f.close(); }
});

test('grant withdrawal blocks queued and leased jobs; abandoned jobs stop after three claims', async () => {
  let now = 1_000_000;
  const f = await fixture(new ConnectorStore(':memory:', () => now));
  try {
    const a = await f.pair();
    const j = f.store.enqueue(a.id, 'SYNC_PREFLIGHT', 'MOCK:alpha', 'revoke');
    const claim = f.store.claim(f.store.getAgent(a.id))!;
    f.store.setGrants(a.id, []);
    assert.equal((await f.request(`/jobs/${j.id}/progress`, { leaseToken: claim.leaseToken, progress: 20 }, a.credential)).status, 403);
    now += LEASE_MS;
    assert.equal(f.store.claim(f.store.getAgent(a.id)), null); assert.equal(f.store.viewJob(j.id).state, 'FAILED');
    const retryJob = f.store.enqueue(a.id, 'CHECK_TALLY', null, 'bounded');
    for (let attempt = 1; attempt <= 3; attempt++) { assert.equal(f.store.claim(f.store.getAgent(a.id))!.attempt, attempt); now += LEASE_MS; }
    assert.equal(f.store.claim(f.store.getAgent(a.id)), null); assert.equal(f.store.viewJob(retryJob.id).state, 'FAILED');
  } finally { await f.close(); }
});

test('SQLite pairing, registry and queue survive reopening; credentials are not stored in plaintext', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tally-db-test-')), file = path.join(dir, 'backend.sqlite');
  let store = new ConnectorStore(file);
  try {
    const p = store.createPairing('tenant','Server','mock', ['MOCK:alpha']);
    const id = randomUUID(), credential = secret(); store.register(p.pairingToken, id, credential, 'mock');
    const job = store.enqueue(id, 'CHECK_TALLY', null, 'persist'); store.close();
    assert.ok(!readFileSync(file).includes(Buffer.from(credential))); assert.ok(!readFileSync(file).includes(Buffer.from(p.pairingToken)));
    store = new ConnectorStore(file); assert.equal(store.authenticate(credential).id, id); assert.equal(store.viewJob(job.id).state, 'QUEUED');
    assert.equal(store.enqueue(id, 'CHECK_TALLY', null, 'persist').id, job.id);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('request size, body shape and forged availability are rejected', async () => {
  const f = await fixture();
  try {
    const a = await f.pair('local', ['guid-a']);
    assert.equal((await f.request('/heartbeat', null, a.credential)).status, 400);
    assert.equal((await f.request('/heartbeat', { arbitrary: 'x'.repeat(70_000) }, a.credential)).status, 413);
    assert.equal((await f.request('/heartbeat', { observation: { adapter: 'local', tallyStatus: 'AVAILABLE', reason: 'CONNECTION_FAILED', companies: [] } }, a.credential)).status, 400);
    assert.equal((await f.request('/heartbeat', { observation: { adapter: 'local', tallyStatus: 'NOT_AVAILABLE', reason: 'CONNECTION_FAILED', companies: [] } }, a.credential)).status, 200);
    assert.equal(f.store.viewAgent(a.id).status, 'ONLINE'); assert.equal(f.store.viewAgent(a.id).tallyStatus, 'NOT_AVAILABLE');
  } finally { await f.close(); }
});

test('parallel duplicate submissions and claims produce one job and one active lease', async () => {
  const f = await fixture();
  try {
    const a = await f.pair();
    const created = await Promise.all(Array.from({ length: 6 }, () => f.request(`/admin/agents/${a.id}/jobs`, { type:'CHECK_TALLY', idempotencyKey:'concurrent' })));
    assert.ok(created.every(v => v.status === 201)); assert.equal(new Set(created.map(v => v.body.id)).size,1);
    const claims = await Promise.all(Array.from({ length: 6 }, () => f.request('/jobs/claim', {}, a.credential)));
    assert.equal(claims.filter(v => v.body.job !== null).length,1);
  } finally { await f.close(); }
});

test('results cannot claim accounting sync, wrong job completion, or real readiness from mock', async () => {
  const f = await fixture();
  try {
    const a = await f.pair(); f.store.enqueue(a.id,'SYNC_PREFLIGHT','MOCK:alpha','result-validation');
    const job = f.store.claim(f.store.getAgent(a.id))!;
    const result = { outcome:'SUCCEEDED', code:'MOCK_PREFLIGHT_ONLY', observation:mockObservation, accountingDataSynced:false };
    for (const forged of [{ ...result, accountingDataSynced:true }, { ...result, code:'CHECKED' }, { ...result, code:'PREFLIGHT_READY' }, { ...result, observation:{ ...mockObservation,companies:[] } }]) {
      assert.equal((await f.request(`/jobs/${job.id}/progress`, { leaseToken:job.leaseToken,progress:100,result:forged },a.credential)).status,400);
    }
    assert.equal(f.store.viewJob(job.id).state,'RUNNING');
  } finally { await f.close(); }
});
