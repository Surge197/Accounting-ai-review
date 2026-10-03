import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { readConfig } from './config';
import { createAdapter } from './adapters';
import { BackendClient } from './http';
import { acquireLock, JobJournal, loadIdentity, LocalLogger, saveIdentity, type Identity } from './local-state';
import { ConnectorAgent } from './agent';
import { PROTOCOL_VERSION } from '../../../shared/connector/protocol';

async function main() {
  const command = process.argv[2];
  if (!['run','once','pair','inspect'].includes(command)) throw new Error('Usage: connector <pair|run|once|inspect> <config.json>');
  const config = readConfig(path.resolve(process.argv[3] ?? 'connector.config.json'));
  if (command === 'inspect') {
    // Explicit local operator diagnostic; does not transmit company metadata to the backend.
    console.log(JSON.stringify(await createAdapter(config).inspect(), null, 2)); return;
  }
  const release = acquireLock(config.dataDir);
  try {
    let identity = loadIdentity(config.dataDir);
    if (identity && (identity.backendUrl !== config.backendUrl || identity.adapter !== config.adapter)) throw new Error('Identity is bound to a different backend or adapter. Use a new data directory and pairing.');
    if (command === 'pair') {
      if (identity?.registered) { console.log(`Already paired: ${identity.agentId}`); return; }
      if (!identity) {
        let input = '';
        for await (const chunk of process.stdin) { input += chunk.toString(); if (input.length > 128) throw new Error('Invalid pairing input'); }
        const pairingToken = input.trim();
        if (!/^[A-Za-z0-9_-]{43}$/.test(pairingToken)) throw new Error('Supply pairing token through standard input');
        identity = { agentId: randomUUID(), credential: randomBytes(32).toString('base64url'), backendUrl: config.backendUrl, adapter: config.adapter, registered: false, pairingToken } satisfies Identity;
        // Durable identity before registration lets a lost response be retried safely.
        saveIdentity(config.dataDir, identity);
      }
      const response = await new BackendClient(config.backendUrl, identity.credential, config.requestTimeoutMs).post<{ agentId: string; tokenExpiresAt: number }>('/register', {
        protocolVersion: PROTOCOL_VERSION, pairingToken: identity.pairingToken, agentId: identity.agentId, credential: identity.credential, adapter: config.adapter,
      });
      identity = { ...identity, registered: true, tokenExpiresAt: response.tokenExpiresAt };
      delete identity.pairingToken;
      saveIdentity(config.dataDir, identity);
      console.log(`Paired agent ${identity.agentId} (${config.adapter}). No accounting data has been synchronized.`); return;
    }
    if (!identity?.registered) throw new Error('Pair the connector first');
    const journal = new JobJournal(config.dataDir);
    try {
      const agent = new ConnectorAgent(config, createAdapter(config), new BackendClient(config.backendUrl, identity.credential, config.requestTimeoutMs), journal, new LocalLogger(path.join(config.dataDir, 'logs')));
      const controller = new AbortController();
      const stop = () => controller.abort();
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      try {
        if (command === 'once') await agent.tick(controller.signal); else await agent.run(controller.signal);
      } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
    } finally { journal.close(); }
  } finally { release(); }
}
main().catch(error => {
  // Errors are intentionally bounded: never dump a response body, secret, or stack.
  console.error(error instanceof Error ? error.message : 'Connector failed'); process.exitCode = 1;
});
