import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { ConnectorStore, secret } from '../../server/connector/store';
import { connectorRouter } from '../../server/connector/router';

export async function fixture(store = new ConnectorStore(':memory:'), insecure = true) {
  const admin = secret(), app = express();
  app.use('/api/connector/v1', connectorRouter(store, { adminToken: admin, allowInsecureLoopback: insecure }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (endpoint: string, body?: unknown, credential = admin, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`${origin}/api/connector/v1${endpoint}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  const pair = async (adapter: 'mock' | 'local' = 'mock', grants = ['MOCK:alpha'], tenantId = 'tenant-a') => {
    const p = await request('/admin/pairings', { tenantId, label: 'Test server', adapter, authorizedCompanyIds: grants });
    const credential = secret(), id = randomUUID();
    const payload = { protocolVersion: 1, pairingToken: p.body.pairingToken, agentId: id, credential, adapter };
    const registration = await request('/register', payload);
    return { id, credential, payload, pairing: p.body, registration };
  };
  return { store, admin, origin, request, pair, async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); store.close(); } };
}
export const mockObservation = { adapter: 'mock' as const, tallyStatus: 'NOT_AVAILABLE' as const, reason: 'MOCK_MODE' as const, simulatedAvailability: true, companies: [{ id: 'MOCK:alpha', name: 'MOCK Alpha' }] };
