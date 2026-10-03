# Windows Tally Connector foundation

This is a separate background agent with an outbound control channel. It does **not** synchronize accounting transactions. No accounting UI files have been changed. Mock mode is deliberately labeled and never reports real Tally availability.

## Repository inspection and reuse decision

The repository is an Express 4 / TypeScript server (`server.ts`) serving a React 19 / Vite 8 application. It originally had no backend database, authentication middleware, Windows service, durable job queue, or agent registry. Client models and integration settings are browser-oriented; integration settings also use browser local storage. There was no usable backend tenant/company authority to inherit.

Existing `src/connectors/tallyConnector.ts` calls `/api/tally/test-connection` and `/api/tally/pull-data`. The old server handlers interpolated caller-supplied hosts/ports into outbound HTTP requests. Those handlers have been removed and the entire `/api/tally` namespace now returns HTTP 410 `CONNECTOR_REQUIRED`, including when the new feature is disabled. `/api/settings/update` rejects Tally settings. Existing UI controls therefore cannot establish a direct connection. Reconnecting those controls to agent status is separate, future work.

`src/tally/tallyXmlParser.ts` parses voucher XML through browser `Document`/`DOMParser`; `src/tally/tallyNormalizer.ts` and `src/normalizer/commonModel.ts` provide useful future normalization contracts. They are preserved unchanged. They are not safe to import directly into a Windows Node process without a tested server-side XML boundary, and voucher parsing is outside this foundation. No Zoho, OpenAI, or data migration implementation was added.

## Architecture

```text
TSplus session -> Tally's local XML endpoint (Windows Server)
                          ^
                          | fixed HTTP POST to 127.0.0.1:<local-config-port>
Windows Service (Node 24 + WinSW, LocalService)
  adapter -> allowlist filter -> heartbeat + leased job worker
  DPAPI identity | SQLite completed-job journal | rotating logs
                          |
                          | outbound HTTPS only; no inbound agent listener
                          v
Existing Express backend /api/connector/v1
  operator authorization -> pairing / company grants / job creation
  agent authentication -> heartbeat / claim / progress / result
                          |
                          v
Durable backend SQLite (single backend instance for this foundation)
```

TypeScript keeps the agent and backend on the repository's existing stack. A bundled CommonJS agent runs with Node 24 LTS; WinSW bridges it to Windows Service Control Manager with delayed automatic start, a restricted service identity, failure restart, and stop handling. A .NET Worker would also be viable, but would introduce a second language/build/runtime without reusable .NET code. No global npm service-install package is required on the server. The Windows installer consumes an independently verified WinSW 2.12.0 x64 executable; it does not download or execute an unverified service wrapper.

Official references: [WinSW 2.12 configuration](https://github.com/winsw/winsw/blob/v2.12.0/doc/xmlConfigFile.md), [Tally XML request/response structure](https://help.tallysolutions.com/understanding-tally-xml-tags/), [Tally XML integration](https://help.tallysolutions.com/xml-integration/), [Node 24 SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html). Node's bundled SQLite API is currently labeled release candidate; the runtime is explicitly pinned to the Node 24 major and the used surface is small.

## Backend and database changes

The feature is opt-in through `CONNECTOR_ENABLED=true`. `mountConnector()` is mounted before the application's larger JSON parser so connector requests have an independent 64 KiB limit. Pairing, heartbeat and job APIs require HTTPS. An explicitly enabled **numeric loopback-only** HTTP exception supports local development; it is rejected when `NODE_ENV=production`.

Since the repository has no existing identity/tenant system, the first operator API uses a separate, high-entropy deployment secret. This credential represents a trusted deployment administrator with access to every connector tenant. It must stay on the backend/operator workstation and must never go into the React application or onto the agent server. Tenant identity and company grants come exclusively from this authenticated operator. Agent requests cannot choose or change their tenant. This is **not** an end-user RBAC implementation.

Four new tables are initialized with `CREATE TABLE IF NOT EXISTS` from `server/connector/schema.sql`:

- `connector_pairings`: hash of a 256-bit single-use token, ten-minute expiry, tenant, server label, adapter mode, company grants, and consumed agent ID.
- `connector_agents`: agent ID, tenant, label, mode, company grants, credential hash/expiry, revocation, backend-clock last-seen time, last observation.
- `connector_jobs`: agent-bound type/company, unique `(agent_id, idempotency_key)`, state, progress, attempt, lease token/expiry, metadata result and timestamps.
- `connector_audit`: operator and job lifecycle events without raw credentials or accounting XML.

This introduces the first persistent store, not a migration of existing accounting data. SQLite uses WAL, full synchronous writes, and transactions for pairing, creation, claims, reports and revocation. Place the backend database on durable local storage, restrict its filesystem permissions, and back up using SQLite-aware tools. Do not place a live SQLite database on a network share or ephemeral hosting disk. Keep one backend deployment instance for this foundation; move the repository interface to a managed transactional database before scaling horizontally. Job and audit retention on the backend requires an operator policy before long-term production use.

Agent state is separate: protected `identity.dpapi`, a local `jobs.sqlite` completed-result journal (30-day retention), an OS-backed SQLite singleton lock, and five approximately 1 MiB application log files. Local journal data is company metadata, not accounting transactions. Only the credential/pending pairing token is DPAPI-encrypted; NTFS protects all local files.

## API contract

All paths below are relative to `/api/connector/v1`. All responses use `Cache-Control: no-store`. Unknown body fields, including host/port/XML payloads, are rejected. The foundation limits inventory/grants to 200 companies per agent.

Operator requests carry `Authorization: Bearer <CONNECTOR_ADMIN_TOKEN>`:

- `POST /admin/pairings`: `{tenantId, label, adapter: "mock" | "local", authorizedCompanyIds: []}` -> short-lived pairing token. Empty company grants deny access to all companies.
- `GET /admin/agents`: up to the latest 500 agents; `GET /admin/agents/:id`: current derived status and last observation. Pagination is future work.
- `PUT /admin/agents/:id/companies`: `{authorizedCompanyIds: []}` replaces backend grants.
- `POST /admin/agents/:id/revoke`: `{}` immediately invalidates credentials and closes pending work.
- `POST /admin/agents/:id/jobs`: `{type, companyId?, idempotencyKey}`. Supported types are `CHECK_TALLY`, `DISCOVER_COMPANIES`, `SYNC_PREFLIGHT`; only preflight requires a company ID. Same key/same payload returns the same job; same key/different payload returns 409. `SYNC_ACCOUNTING` explicitly returns 501.
- `GET /admin/jobs/:id`: state, attempt, progress and metadata result. Lease secrets are excluded.

Agent registration: `POST /register` with `{protocolVersion: 1, pairingToken, agentId, credential, adapter}`. The agent generates and protects its identity **before** submitting it. The backend stores SHA-256 hashes of uniformly random 256-bit secrets. An exact registration retry with the same identity is allowed only until pairing expiry, for lost-response recovery; another identity cannot reuse the token. Registered agents begin OFFLINE until their first heartbeat. Credentials expire after 90 days and can be revoked immediately. Automatic rotation is future work; revoke and re-pair before expiry.

Authenticated agent endpoints use that agent's credential, not the operator secret:

- `POST /heartbeat`: `{observation}` -> backend company grants and heartbeat interval.
- `POST /jobs/claim`: `{}` -> a job with a fresh lease, or `job: null`.
- `POST /jobs/:id/progress`: `{leaseToken, progress, result?}`; final progress is 100 and `accountingDataSynced` is always false.

Job states are QUEUED -> RUNNING -> SUCCEEDED/FAILED. Leases are 60 seconds, renewed by accepted progress; there is one active lease per agent and at most three delivery attempts. Late or superseded workers cannot finish a job. Permission withdrawal is checked at enqueue, claim and report. Company discovery intersects the locally configured allowlist and backend grants; backend filtering is also applied before storage and retrieval.

The first heartbeat intentionally uploads no companies until backend grants are learned. If newly learned grants change the permitted inventory, the same cycle sends a second filtered heartbeat immediately. Jobs here are short and read-only. Local and backend requests have bounded timeouts (at most 5 seconds each). Before adding long accounting jobs, split heartbeat/lease renewal into an independent supervised loop.

Delivery is at-least-once with idempotent creation, fenced leases, idempotent terminal reports and a durable completed-result journal. A process crash between a read-only probe and journal commit can repeat that probe. This is not an exactly-once accounting synchronization guarantee. Once a result is journaled, redelivery reuses it. Cached preflight metadata reflects the original attempt; it must not be treated as fresh permission or readiness for a future export.

## Status semantics and adapters

- Agent ONLINE means an authenticated heartbeat arrived within 60 seconds and the credential is active. Status is calculated using backend time, not the server's local clock. After expiry/revocation or 60 seconds without heartbeat, status is OFFLINE.
- An offline agent's effective Tally status is UNKNOWN. `lastObservation` remains visible with `observationStale: true`, so an old AVAILABLE observation is not shown as current.
- Local adapter AVAILABLE means a fixed company collection request to `127.0.0.1` returned the expected Tally envelope, successful header and parseable inventory. Refusal/timeout yields NOT_AVAILABLE/CONNECTION_FAILED; malformed/error/oversized responses yield NOT_AVAILABLE/INVALID_RESPONSE. Redirects are refused. DTDs and entities declarations are rejected. Company GUIDs must be present and unique; unsupported Tally response shapes fail closed.
- Mock adapter always reports `adapter: "mock"`, `tallyStatus: "NOT_AVAILABLE"`, `reason: "MOCK_MODE"`. `simulatedAvailability` is a separate test field. Demo IDs begin with `MOCK:`. Mock preflight returns `MOCK_PREFLIGHT_ONLY`, never `PREFLIGHT_READY`.
- `CHECK_TALLY` completing successfully means the check ran; inspect its observation to see whether Tally was reachable. Discovery or preflight fails when the selected adapter is unavailable. Real preflight checks that a permitted company is loaded; it exports no vouchers.

## Run locally on Windows

Prerequisite: Node.js **24 LTS** and npm. Use `package-lock.json` / `npm ci`; the older `bun.lock` is retained as the supplied repository artifact and is not the connector installation source of truth.

```powershell
npm ci
npm run connector:check
npm test
npm run lint
npm run build
npm run connector:build
npm run connector:smoke
```

The deployable agent is `dist-connector/connector.cjs`; it includes the XML parser and needs no `node_modules` or React app on the Tally server.

Start the development backend in one PowerShell window:

```powershell
$env:CONNECTOR_ENABLED = 'true'
$env:CONNECTOR_ADMIN_TOKEN = (node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")
$env:CONNECTOR_DB_PATH = "$PWD\data\connector.sqlite"
$env:CONNECTOR_ALLOW_INSECURE_LOOPBACK = 'true'
npm run dev
```

Do not copy these development HTTP settings into production. Create a pairing from a separate trusted operator session using the same operator token, supplied through your secret-management process:

```powershell
$base = 'http://127.0.0.1:3000/api/connector/v1'
$headers = @{ Authorization = "Bearer $env:CONNECTOR_ADMIN_TOKEN" }
$body = @{ tenantId = 'test-tenant'; label = 'Windows mock test'; adapter = 'mock'; authorizedCompanyIds = @('MOCK:alpha') } | ConvertTo-Json
$pair = Invoke-RestMethod -Method Post -Uri "$base/admin/pairings" -Headers $headers -ContentType 'application/json' -Body $body
# The following sends the short-lived token through stdin, not the process arguments.
$pair.pairingToken | node .\dist-connector\connector.cjs pair .\services\tally-connector\connector.mock.example.json
node .\dist-connector\connector.cjs run .\services\tally-connector\connector.mock.example.json
```

The sample uses `services/tally-connector/local-data` for development. Protect that directory from other users before placing real credentials there; the service installer applies the required ACLs for deployed agents. In another operator window:

```powershell
$agents = Invoke-RestMethod -Uri "$base/admin/agents" -Headers $headers
$agentId = $agents.agents[0].id
$jobBody = @{ type = 'SYNC_PREFLIGHT'; companyId = 'MOCK:alpha'; idempotencyKey = 'first-preflight-001' } | ConvertTo-Json
$job = Invoke-RestMethod -Method Post -Uri "$base/admin/agents/$agentId/jobs" -Headers $headers -ContentType 'application/json' -Body $jobBody
Invoke-RestMethod -Uri "$base/admin/jobs/$($job.id)" -Headers $headers
Invoke-RestMethod -Uri "$base/admin/agents/$agentId" -Headers $headers
```

After the next poll, expect SUCCEEDED, progress 100, MOCK_PREFLIGHT_ONLY, and `accountingDataSynced: false`. Repeat creation with the same key: the job ID must stay the same. Stop the agent and check again after 60 seconds: OFFLINE and effective Tally UNKNOWN. Start it again: the identity is reused.

## Install on the TSplus Windows Server

1. Provide a central backend with a valid HTTPS certificate, durable database and securely provisioned operator secret. Set `NODE_ENV=production`; do not enable the development HTTP exception. When terminating TLS at a reverse proxy, configure `CONNECTOR_TRUST_PROXY` to the **exact** trusted proxy address/CIDR, have that proxy overwrite forwarding headers, and prevent any direct public connection to the Express origin. Do not use a blanket trust-proxy setting. Redact authorization headers and registration bodies in reverse-proxy logs. Keep `/admin/` routes additionally restricted to an operator network.
2. Install Node 24 LTS on the Windows Server. Copy `dist-connector` there. Obtain WinSW 2.12.0 x64 from its official release and verify its SHA-256 against your independently approved release checksum. The installer requires that checksum; it does not invent or fetch a checksum from the same supplied binary.
3. Copy `connector.local.example.json` to a configuration file, set the real backend HTTPS origin and the local Tally XML port. There is intentionally no host setting. Start Tally and enable its XML/HTTP server according to your installed Tally version. Run `node .\dist-connector\connector.cjs inspect .\connector.config.json` as the local operator to see actual loaded company GUIDs. This is a local-only diagnostic and prints names, so handle its output appropriately. No Tally installation is bundled or started by the connector.
4. Put only approved company GUIDs into the local `authorizedCompanyIds`; issue the backend pairing with the same tenant and approved IDs and `adapter: "local"`. For initial tests without Tally, choose explicit mock mode and an **HTTPS** backend instead. A paired mode cannot be changed silently; use a new identity and pairing when moving from mock to local.
5. From elevated PowerShell, run the installer (substitute your verified paths/checksum):

```powershell
.\dist-connector\windows\Install-Connector.ps1 `
  -ConfigPath .\connector.config.json `
  -WinSwPath C:\Installers\WinSW-x64.exe `
  -WinSwSha256 '<independently-verified-64-character-sha256>'
& "$env:ProgramFiles\AccountingTallyConnector\Pair-Connector.ps1"
Start-Service AccountingTallyConnector
Get-Service AccountingTallyConnector
```

The installer sets delayed automatic startup and recovery, stores executable/configuration under administrator-controlled paths, and restricts the data directory to Administrators, SYSTEM and LocalService. LocalService has read/execute access to code/config and modify access to state/logs. The one-time pairing prompt hides input; only DPAPI ciphertext persists. Installation deliberately leaves the service stopped until it is paired. Reboot should then start the paired service automatically.

LocalMachine DPAPI enables administrator provisioning followed by LocalService use. Its confidentiality relies on NTFS ACLs: another local user who can read the ciphertext can decrypt machine-scoped data. Administrators and services running as the same LocalService identity remain trusted. A dedicated managed service account and user-scoped credential protection are possible later hardening choices. Do not clone the protected state directory onto another server or share it between agents.

Logs: `C:\ProgramData\AccountingTallyConnector\data\logs`. Config: `C:\ProgramData\AccountingTallyConnector\connector.config.json`. Stop the service before editing local permissions/configuration and restart afterwards. Backend permission removal takes effect immediately at backend enforcement and on the next heartbeat locally.

Use `Stop-Service AccountingTallyConnector` for shutdown. `Uninstall-Connector.ps1` removes the service registration while retaining data and binaries. Revoke its agent in the central backend when retiring a server. For an expired pending pairing or lost/expired credential, revoke any partially registered identity, stop the service, move the old protected identity and local journal to an administrator-only backup, and pair again; do not turn on a plaintext fallback. Pairing retries must happen within the original ten-minute window.

## TSplus acceptance test checklist

These checks require your actual server and are separate from automated fixture tests:

1. Reboot with no interactive TSplus login. Verify the Windows connector service starts and the agent becomes ONLINE. Tally may correctly be NOT_AVAILABLE until its actual process is started.
2. Start Tally, load at least two approved companies, and run discovery and individual preflight jobs. Confirm real GUIDs, `adapter: local`, and no unapproved companies reaching the backend. A company being listed by Tally is not automatically authorized by the connector.
3. Remove one company from either allowlist. Attempts for that company must fail/deny; other companies remain isolated. Submit a duplicate idempotency key and confirm a single job.
4. Close Tally or disable its local endpoint: agent stays ONLINE, Tally becomes NOT_AVAILABLE. Restart Tally: availability recovers after a heartbeat. Test an empty company list separately.
5. Disconnect a TSplus session, then log it off. Observe whether this installation leaves Tally running. Windows services run in session 0; the connector does not keep a user's Tally process alive, unlock companies, bypass Tally security or guarantee availability across session logoff. Multiple Tally processes/ports require an explicit deployment design; this foundation supports one local Tally endpoint per agent, containing multiple companies.
6. Block outbound HTTPS temporarily. Verify retries in local logs and backend OFFLINE after 60 seconds. Restore access and verify recovery. Restart the backend and agent during a mock job to test durable state. Polling can take up to 30 seconds to resume after repeated network failures.
7. Revoke the agent credential. New heartbeats/claims fail with 401 and operator-action logs; service recovery cannot bypass revocation. Re-pair intentionally.
8. From another machine, verify the Tally port is unreachable. Configure Windows Firewall to block inbound access to that port on all applicable profiles and remove NAT/router port forwarding. An agent connection to loopback does not by itself change Tally's bind address or firewall. Confirm the connector opens no listening port and only makes the expected outbound backend/local requests.

## Security boundaries and next work

There are no arbitrary hosts, XML commands, shell jobs, callback URLs or accounting uploads in the job API. TLS certificate validation stays enabled; credentials cannot be redirected to another origin. Companies are authorized by stable Tally GUID, not display name. Pairings are mode-bound and expire; agent credentials are hashed centrally, protected locally, expiring and revocable. Payload sizes, XML responses, job types and retries are bounded, and agent logs avoid secrets and raw Tally data.

The wider existing application still contains unrelated unauthenticated settings/AI/Zoho routes. They were not redesigned or secured as part of this connector task. Expose only the new connector routes at the connector ingress until the rest of the application's authentication has been reviewed. Do not treat this foundation as a complete production security audit.

Next, validate real Tally discovery on the TSplus server and capture sanitized response fixtures for each supported version. Then add proper operator/tenant RBAC, credential rotation, audit retention and deployment packaging/signing. Only after those gates add a tightly scoped company export job, independent heartbeat/lease renewal, incremental cursors, checkpointed/resumable uploads, backend deduplication and transaction normalization tests using the existing accounting model. Full accounting synchronization remains unimplemented.

## Verification completed on 2026-09-26

- `npm test`: 18 passed, 0 failed, 0 skipped; includes real Windows DPAPI encryption/decryption and local protocol fixture servers.
- `npm run connector:check` and `npm run lint`: passed.
- `npm run build`: existing React application production build passed. It retains its pre-existing large-bundle/configuration warnings.
- `npm run connector:build`: standalone agent bundle passed, including third-party license notices.
- `npm run connector:smoke`: packaged agent against the actual `server.ts` entry point passed pairing, heartbeat, authorized mock company discovery, preflight, legacy-route rejection, and backend/agent restart without duplicate work. The local test proxy represents TLS termination for routing; it does not assert real TLS encryption.
- All three Windows scripts passed PowerShell syntax parsing; WinSW 2.12 service-account configuration was checked against the version-specific official documentation.
- SHA-256 comparison verified all 43 original `src/` files unchanged.
- `npm audit`: one existing high-severity `xlsx` dependency with prototype-pollution and ReDoS advisories, no npm-provided fix. It is outside the connector bundle and was not changed as part of this task.

Actual Windows service installation/reboot, TSplus session behavior, production HTTPS certificates, and real Tally response compatibility require the acceptance tests above. They have not been performed against your server.

## Files delivered

Created:

- `shared/connector/protocol.ts`: versioned control-plane types and timing constants.
- `server/connector/{mount.ts,router.ts,store.ts,schema.sql}`: backend integration, validation/authentication, persistent registry/queue and schema.
- `services/tally-connector/src/{main.ts,config.ts,agent.ts,http.ts,adapters.ts,local-state.ts}`: agent CLI, outbound worker, adapter boundary and local persistence/protection.
- `services/tally-connector/{connector.mock.example.json,connector.local.example.json,tsconfig.json}`: explicit configurations and strict type-check target.
- `services/tally-connector/windows/{Install-Connector.ps1,Pair-Connector.ps1,Uninstall-Connector.ps1}`: service lifecycle scripts.
- `scripts/build-connector.mjs`: standalone Node bundle with third-party license notices.
- `scripts/licenses/*`: verified upstream MIT notices omitted by two published dependencies.
- `tests/connector/{helpers.ts,backend.test.ts,adapter.test.ts,agent.test.ts,smoke.ts}`: authorization, persistence, protocol, mock, agent and packaged-agent tests.
- `package-lock.json`: reproducible npm dependency resolution.
- This runbook, `docs/tally-connector.md`.

Modified: `server.ts` (mount connector and remove direct Tally networking/settings), `package.json` (commands, Node 24, XML parser, compatible esbuild and Node types), `.env.example`, `.gitignore`, and `README.md` (entry point to this runbook). All `src/` files are unchanged.
