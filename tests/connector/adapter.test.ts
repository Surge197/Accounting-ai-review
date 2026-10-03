import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { LocalTallyAdapter, MockTallyAdapter, parseCompanyResponse, COMPANY_REQUEST } from '../../services/tally-connector/src/adapters';

// Deliberate protocol fixtures; these tests are not evidence of a live Tally installation.
const xml = '<ENVELOPE><HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER><BODY><DATA><COLLECTION><COMPANY NAME="A &amp; B"><GUID>guid-a</GUID></COMPANY><COMPANY><NAME>Second</NAME><GUID>guid-b</GUID></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>';
test('strict Tally company parsing with stable IDs and XML entities', () => {
  assert.deepEqual(parseCompanyResponse(xml), [{ id: 'guid-a', name: 'A & B' }, { id: 'guid-b', name: 'Second' }]);
  assert.deepEqual(parseCompanyResponse(xml.replace(/<COMPANY[\s\S]*<\/COMPANY>/, '')), []);
  for (const invalid of ['<html>OK</html>','<ENVELOPE>', xml.replace('<STATUS>1</STATUS>','<STATUS>0</STATUS>'), xml.replace('<GUID>guid-a</GUID>', ''), xml.replace('guid-b','guid-a'), '<!DOCTYPE ENVELOPE [<!ENTITY evil SYSTEM "file:///secret">]>' + xml, xml.replace('</DATA>','<LINEERROR>Denied</LINEERROR></DATA>')]) assert.throws(() => parseCompanyResponse(invalid));
  assert.ok(COMPANY_REQUEST.includes('<TYPE>Company</TYPE>')); assert.ok(!COMPANY_REQUEST.includes('Voucher'));
});

test('local HTTP adapter validates response, rejects redirects/oversize and handles refusal/timeout', async () => {
  let responseMode = 'ok', requests = 0;
  const server = createServer(async (req, res) => {
    requests++; let body = ''; for await (const chunk of req) body += chunk;
    assert.equal(req.method, 'POST'); assert.equal(body, COMPANY_REQUEST);
    if (responseMode === 'ok') res.end(xml);
    else if (responseMode === 'utf16') res.end(Buffer.concat([Buffer.from([255,254]),Buffer.from(xml,'utf16le')]));
    else if (responseMode === 'redirect') { res.statusCode = 302; res.setHeader('Location', 'http://example.com'); res.end(); }
    else if (responseMode === 'timeout') { /* Client must abort. */ }
    else if (responseMode === 'large') res.end('x'.repeat(1024 * 1024 + 1));
    else res.end('<html>ordinary web server</html>');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  try {
    const adapter = new LocalTallyAdapter(port, 150);
    assert.equal((await adapter.inspect()).tallyStatus, 'AVAILABLE');
    responseMode = 'utf16'; assert.equal((await adapter.inspect()).companies.length, 2);
    for (const mode of ['redirect','html','large','timeout']) { responseMode = mode; assert.equal((await adapter.inspect()).tallyStatus, 'NOT_AVAILABLE'); }
    assert.equal(requests, 6);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  assert.equal((await new LocalTallyAdapter(port, 150).inspect()).reason, 'CONNECTION_FAILED');
});

test('mock never claims Tally connectivity and returns no companies when simulated unavailable', async () => {
  const available = await new MockTallyAdapter(true, [{ id: 'MOCK:one', name: 'MOCK ONLY' }]).inspect();
  assert.equal(available.tallyStatus, 'NOT_AVAILABLE'); assert.equal(available.reason, 'MOCK_MODE'); assert.equal(available.simulatedAvailability, true);
  const offline = await new MockTallyAdapter(false, [{ id: 'MOCK:one', name: 'MOCK ONLY' }]).inspect();
  assert.deepEqual(offline.companies, []); assert.equal(offline.simulatedAvailability, false);
});
