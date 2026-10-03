import type { Express } from 'express';
import { connectorRouter } from './router';
import { ConnectorStore } from './store';

export function mountConnector(app: Express, env = process.env) {
  // These old routes must never initiate a network request, even when the agent feature is disabled.
  app.use('/api/tally', (_req, res) => {
    res.status(410).json({ success: false, status: 'CONNECTOR_REQUIRED', code: 'CONNECTOR_REQUIRED', message: 'Direct backend-to-Tally access is disabled. Use the paired Windows Connector.' });
  });
  if (env.CONNECTOR_ENABLED !== 'true') {
    app.use('/api/connector', (_req, res) => { res.status(503).json({ error: 'Connector backend is not configured' }); });
    return;
  }
  if (env.NODE_ENV === 'production' && env.CONNECTOR_ALLOW_INSECURE_LOOPBACK === 'true') throw new Error('Development HTTP bypass is forbidden in production');
  if (env.CONNECTOR_TRUST_PROXY) app.set('trust proxy', env.CONNECTOR_TRUST_PROXY.split(',').map(value => value.trim()));
  if (!env.CONNECTOR_DB_PATH) throw new Error('CONNECTOR_DB_PATH must point to durable backend storage');
  const store = new ConnectorStore(env.CONNECTOR_DB_PATH);
  app.use('/api/connector/v1', connectorRouter(store, { adminToken: env.CONNECTOR_ADMIN_TOKEN ?? '', allowInsecureLoopback: env.CONNECTOR_ALLOW_INSECURE_LOOPBACK === 'true' }));
  return store;
}
