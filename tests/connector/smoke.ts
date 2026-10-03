// Packaged Windows agent against the real server.ts entry point, explicitly in mock mode.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(os.tmpdir(), 'tally-packaged-smoke-'));
const admin = randomBytes(32).toString('base64url');
const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
const port = (reservation.address() as import('node:net').AddressInfo).port;
await new Promise<void>(resolve => reservation.close(() => resolve()));
const origin = `http://127.0.0.1:${port}`;
let backend: ChildProcess | undefined;
let serverOutput = '';
async function startBackend() {
  backend = spawn(process.execPath, ['--import','tsx','server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), GEMINI_API_KEY: '', CONNECTOR_ENABLED: 'true',
      CONNECTOR_ADMIN_TOKEN: admin, CONNECTOR_DB_PATH: path.join(dir, 'backend.sqlite'),
      // HTTP development bypass is intentionally unavailable in production. We model a local trusted TLS terminator for the backend smoke test.
      CONNECTOR_ALLOW_INSECURE_LOOPBACK: 'false', CONNECTOR_TRUST_PROXY: 'loopback' },
    stdio: ['ignore','pipe','pipe'], windowsHide: true,
  });
  backend.stdout?.on('data', chunk => { serverOutput += chunk; }); backend.stderr?.on('data', chunk => { serverOutput += chunk; });
  for (let i = 0; i < 100; i++) {
    if (backend.exitCode !== null) throw new Error('Backend startup failed');
    try { if ((await fetch(`${origin}/api/settings/status`, { signal: AbortSignal.timeout(200) })).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Backend startup timed out');
}
async function stopBackend() {
  if (backend && backend.exitCode === null) { const exited = once(backend, 'exit'); backend.kill(); await exited; }
}
const request = async (endpoint: string, body?: unknown) => {
  const response = await fetch(`${origin}/api/connector/v1${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${admin}`, 'x-forwarded-proto':'https' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  assert.ok(response.ok, `Request ${endpoint} failed: ${response.status}`);
  return response.json() as Promise<any>;
};
async function runAgent(command: string, input = '') {
  const child = spawn(process.execPath, ['dist-connector/connector.cjs', command, path.join(dir,'config.json')], { windowsHide: true, stdio: ['pipe','pipe','pipe'], env: { ...process.env, NODE_ENV:'development' } });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  child.stdin.end(input);
  const [code] = await once(child, 'exit'); assert.equal(code, 0, `Packaged agent ${command} failed`);
  assert.ok(!output.includes(admin)); return output;
}

// This local-only reverse proxy represents the deployed TLS terminator for routing.
// It does NOT test TLS encryption: negative transport-policy tests live in backend.test.ts.
import http from 'node:http';
const proxy = http.createServer(async (req, res) => {
  try {
    let body = ''; for await (const chunk of req) body += chunk;
    const upstream = await fetch(`${origin}${req.url}`, { method: req.method, headers: { 'content-type':'application/json', authorization: req.headers.authorization ?? '', 'x-forwarded-proto':'https' }, ...(body ? { body } : {}) });
    res.writeHead(upstream.status, { 'content-type':'application/json' }); res.end(await upstream.text());
  } catch { res.statusCode = 502; res.end('{}'); }
});
proxy.listen(0,'127.0.0.1'); await once(proxy,'listening');
const proxyPort = (proxy.address() as import('node:net').AddressInfo).port;
try {
  writeFileSync(path.join(dir,'config.json'), JSON.stringify({ backendUrl: `http://127.0.0.1:${proxyPort}`, allowInsecureLoopback: true, dataDir: path.join(dir,'agent'), adapter:'mock', authorizedCompanyIds:['MOCK:alpha'], mockAvailable: true, mockCompanies:[{ id:'MOCK:alpha', name:'MOCK ONLY Alpha' },{ id:'MOCK:denied', name:'MOCK ONLY Denied' }] }));
  await startBackend();
  const pair = await request('/admin/pairings', { tenantId:'smoke-tenant',label:'Packaged mock test',adapter:'mock',authorizedCompanyIds:['MOCK:alpha'] });
  await runAgent('pair', pair.pairingToken);
  const agents = await request('/admin/agents'); assert.equal(agents.agents.length, 1); const id = agents.agents[0].id;
  assert.equal(agents.agents[0].status, 'OFFLINE');
  const payload = { type:'SYNC_PREFLIGHT', companyId:'MOCK:alpha', idempotencyKey:'packaged-smoke' };
  const job = await request(`/admin/agents/${id}/jobs`, payload);
  await runAgent('once');
  const final = await request(`/admin/jobs/${job.id}`);
  assert.equal(final.state,'SUCCEEDED'); assert.equal(final.result.code,'MOCK_PREFLIGHT_ONLY'); assert.equal(final.result.accountingDataSynced,false);
  await runAgent('once');
  const live = await request(`/admin/agents/${id}`);
  assert.equal(live.status,'ONLINE'); assert.equal(live.tallyStatus,'NOT_AVAILABLE'); assert.equal(live.lastObservation.reason,'MOCK_MODE');
  assert.deepEqual(live.lastObservation.companies.map((c: any) => c.id), ['MOCK:alpha']);
  const legacy = await fetch(`${origin}/api/tally/test-connection`, { method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({host:'169.254.169.254',port:80}) }); assert.equal(legacy.status,410);
  const settings = await fetch(`${origin}/api/settings/update`, { method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tally:{host:'evil',port:9000}}) }); assert.equal(settings.status,410);
  await stopBackend(); await startBackend();
  assert.equal((await request(`/admin/agents/${id}/jobs`, payload)).id, job.id);
  await runAgent('once'); assert.equal((await request(`/admin/jobs/${job.id}`)).attempt,1);
  assert.ok(!readFileSync(path.join(dir,'agent/identity.dpapi'),'utf8').includes(pair.pairingToken));
  assert.ok(!serverOutput.includes(pair.pairingToken)); assert.ok(!serverOutput.includes(admin));
  console.log('PASS: packaged Windows mock agent paired, heartbeated, filtered companies, completed preflight, rejected legacy networking, and survived backend/agent restart without a duplicate job. TLS encryption and actual Tally/service installation are not asserted by this smoke test.');
} finally {
  await stopBackend(); proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve()));
  rmSync(dir, { recursive:true,force:true });
}
