PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = FULL;
CREATE TABLE IF NOT EXISTS connector_pairings (
  token_hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, label TEXT NOT NULL,
  adapter TEXT NOT NULL CHECK(adapter IN ('local','mock')), grants TEXT NOT NULL,
  expires_at INTEGER NOT NULL, used_by TEXT
);
CREATE TABLE IF NOT EXISTS connector_agents (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, label TEXT NOT NULL,
  adapter TEXT NOT NULL CHECK(adapter IN ('local','mock')), grants TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, token_expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL, last_seen_at INTEGER, revoked_at INTEGER,
  observation TEXT
);
CREATE TABLE IF NOT EXISTS connector_jobs (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES connector_agents(id),
  idempotency_key TEXT NOT NULL, type TEXT NOT NULL
    CHECK(type IN ('CHECK_TALLY','DISCOVER_COMPANIES','SYNC_PREFLIGHT')),
  company_id TEXT, state TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK(state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  attempt INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_expires_at INTEGER,
  result TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE(agent_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS connector_jobs_poll ON connector_jobs(agent_id, state, created_at);
CREATE TABLE IF NOT EXISTS connector_audit (
  id INTEGER PRIMARY KEY, at INTEGER NOT NULL, event TEXT NOT NULL,
  agent_id TEXT, detail TEXT NOT NULL
);
