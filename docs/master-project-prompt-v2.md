# MASTER PROJECT PROMPT v2 — Accounting AI Review Platform

Version date: 2026-10-07

## What this software is

I run an accounting practice with 70+ active clients whose books are in TallyPrime and Zoho Books. The intended Tally environment is a Windows Server accessed through TSplus, with one shared Tally instance in which users switch companies. Treat that description as the deployment requirement; verify the actual process, session, company-loading and permission behavior on the server before claiming unattended coverage.

Build a platform that collects authorized accounting data, maintains a per-client change timeline, produces cash-flow and money-movement summaries, identifies potential accounting errors, supports bank reconciliation, and provides downloadable review reports. Findings assist an auditor; they are not an automated audit opinion or proof of an error or fraud.

This document describes the target and development protocol. It does not claim that the target is already implemented. Do not redesign the existing application or implement unrelated features.

## What already exists

Baseline inspected on 2026-10-07, before implementing v2 Step 1:

- React/Vite frontend with single-company review, multi-client portfolio and risk matrix. The current working tree starts with empty client and transaction lists after removal of demo defaults.
- A deterministic engine advertised as 18 rules, with several checks grouped into shared conditions. A complete rule catalog and independently validated accounting coverage remain to be established.
- Snapshot comparisons with up to five snapshots per client in React memory; no durable accounting workspace.
- Gemini/OpenAI explanation code with deterministic fallback; successful live-provider operation has not been established.
- Excel exports and browser print-to-PDF.
- Partial Zoho collection: three pages of 200 records per resource, incomplete error reporting, no complete OAuth refresh lifecycle, and simplified tax/transaction mapping.
- Windows connector foundation in `services/tally-connector/`, backend in `server/connector/`, shared protocol in `shared/connector/`: pairing, credentials, company grants, heartbeat, jobs, SQLite, local credential protection, logs and Windows service scripts. Its 18 automated tests last passed in this chat on 2026-10-07. These are connector tests, not full application acceptance tests.
- The existing local adapter makes loopback metadata requests. No TDL exporter or folder watcher exists. `SYNC_ACCOUNTING` is explicitly unimplemented. Real Tally, TSplus behavior and Windows service deployment remain unverified.
- Connector SQLite stores registry/job/audit metadata, not the accounting transaction database required below.
- Ten TypeScript errors in the obsolete `src/clients/defaultClients.ts` module; settings payload rejection; an empty-period fallback that reviews all transactions; double-counted flagged amounts; hardcoded review dates; and import paths that invent missing dates.

Inspect the actual repository and Git changes at every new session. Preserve existing uncommitted work. Treat these baseline statements as dated evidence, not a substitute for fresh inspection or user acceptance.

The repository currently requires Node.js 24 (`>=24 <25`); use its `package-lock.json` for reproducible npm dependencies. Run commands from the project root. Windows service deployment additionally follows `docs/tally-connector.md`; a local build is not a service-installation or TSplus acceptance test.

## Architecture decisions and boundaries

1. **Tally sends data to my platform.** The target is event-driven TDL export of successfully saved vouchers into a protected local XML folder, followed by secure outbound delivery to my backend. Nothing in this flow creates or changes Zoho records. Tally-to-Zoho migration and bidirectional synchronization are outside this plan. Zoho Books does support incoming webhooks running custom functions; we choose its REST API for the separate read integration, not because webhooks are absent.
2. **Reuse the existing connector.** Prefer a folder-ingestion adapter inside the existing Node/TypeScript Windows service. Reuse its registration, authentication, company authorization, credential protection, heartbeat, logging and deployment infrastructure. Python is optional, not mandatory. If a demonstrated dependency requires a Python helper, integrate it under that service boundary with explicit lifecycle and credential ownership; do not build a competing agent. New file ingestion must not depend on port-9000 polling. Existing metadata checks must be accounted for explicitly when configuring file mode; do not silently claim they have already disappeared or remove them during an unrelated step.
3. **Preserve the security boundary.** Never expose Tally to the public internet or restore backend access to arbitrary user-supplied Tally hosts/ports. Use authenticated outbound HTTPS, validated certificates, protected filesystem paths and revocable credentials. The backend derives tenant/company permission from trusted identity and grants, never from an unverified payload ID. Protect settings, accounting data, reports and live subscriptions with appropriate authorization. Do not put deployment operator secrets or provider credentials into frontend code, browser storage, logs or reports.
4. **Validate shared-instance operation.** Do not silently change the interactive user's selected company. An absolute ban on a particular TDL variable is not a substitute for safe company scoping. Establish a tested way to export each authorized company without disrupting users, including unloaded/locked companies, company switching, imports, restarts and TSplus disconnect/logoff. If this cannot be demonstrated, report the limitation and request a decision before changing the architecture.
5. **Identity is independent of voucher number.** Use a backend tenant/client binding, stable company GUID and stable source voucher GUID for transaction identity. Use a source revision/change identifier and an event ID for deliveries. Retrying the same event must be harmless; an edited voucher must update its version rather than create another transaction. Reject conflicting reuse of an event ID, retain history and prevent delayed events from overwriting newer state. Voucher numbers remain display/search attributes. Define behavior for restored/cloned company data before accepting conflicting identities.
6. **Store a complete, traceable accounting model before live ingestion.** Preserve voucher headers, balanced posting lines where available, stable account/party IDs, bill allocations, opening balances, source IDs, original amounts/currencies, client base currency, source revisions and provenance. Missing source data must remain explicit; never manufacture balancing lines, dates or allocations. Use decimal-safe arithmetic and documented rounding. A bank statement row is a distinct source record that can link to book postings; it must not masquerade as a Tally/Zoho voucher.
7. **Baseline and reconciliation establish completeness.** An initial authorized historical import supplies the agreed period, masters, outstanding bills and opening balances. Reconcile event streams against complete, company-scoped exports with a declared period and consistent cutoff. A failed, partial, stale or unavailable export must not imply deletion. Cover older vouchers within the monitored history; today's Day Book alone is insufficient. Distinguish deletion, cancellation and reversal. TDL deletion/cancellation events may supplement reconciliation after their coverage is tested.
8. **Auditing has two execution layers.** Run eligible checks on bounded batches per client every 10–30 seconds. Checks such as negative cash and duplicates can consult committed historical state; they are not necessarily stateless per-voucher checks. Run aggregate checks every 30 minutes and at the configured client day close. Use a maximum batch wait so sustained traffic cannot starve review. Rule outcomes must state their evidence, confidence, period and source completeness. Missing prerequisites produce an explicit not-evaluated result, not a false clean result.
9. **Bank data preserves original meaning.** Support BOC Hong Kong consolidated PDFs in Chinese and English, multiple accounts, currencies and floating currency headers. Keep source page/row evidence, statement period and opening/closing balances. HKD is the base currency for the relevant BOC client, not an unconditional default for all clients. Preserve original amounts. Use an approved historical FX source and a documented client policy for rate date, transaction/value date, timezone, holidays, missing rates, quotation direction and rounding. Store the rate and its provenance. Never silently use today's rate. `yfinance` is not mandated for production: its documentation warns about Yahoo data-use restrictions, so suitability and rights must be resolved before provider selection.
10. **Reconciliation explains differences.** Support matched, unmatched and ambiguous statuses, with account/currency scoping, date/amount tolerances and supported one-to-many or many-to-one matches. Timing differences, bank fees and grouped settlements must not be forced into false matches. Preserve both sources and any user-confirmed decisions. Converting to a common currency alone does not establish a match.
11. **Live views and formal reports have different lifecycles.** The dashboard shows current authorized state and freshness/completeness. Formal PDF/Excel reports use a frozen data revision, as-of time, rule version, configuration and FX provenance. Generate on demand or at configured day close, never per incoming event. A download must match its frozen dashboard/report revision even if newer data arrives during generation.

These are the agreed direction and constraints. If repository evidence, official documentation or a real-server test contradicts an assumption, explain it with evidence and request my decision. Do not silently substitute a different design, ignore a security boundary, or mark an unverifiable capability as working.

## The 11 steps — strict order

The plan still has exactly eleven steps. Dependencies are corrected by moving the former Step 9 storage work before rules and ingestion. Mapping from v1 to v2: old 1/2/3 remain 1/2/3; old 9 becomes 4; old 4 becomes 5; old 5 becomes 6; old 6 becomes 7; old 7 becomes 8; old 8 becomes 9; old 10/11 remain 10/11. No original feature is dropped. Model, security and completeness work is included only where required by the current step.

### Step 1 — Restore the application type check

Fix the ten TypeScript errors in `src/clients/defaultClients.ts`, respecting the current removal of demo defaults and the empty application startup. Keep the fix focused. Do not relabel synthetic fixtures as real file/live data, restore removed sample modes, weaken types, suppress errors or exclude the failing file from compilation. Do not touch settings, accounting rules or later-step functionality.

**Success test:** From the project root, run `npx tsc --noEmit`. It must exit 0 with no TypeScript errors. Run `npm run build` as a build check; it must exit 0. Existing unrelated build warnings must be reported. Confirm the application still starts without automatically seeded clients. Only my explicit PASS accepts the step.

### Step 2 — Repair and protect integration settings

Fix the form/backend payload mismatch. Save permitted AI/Zoho settings and connector-related references/status through appropriate contracts; keep Tally host/port configuration local to the connector and legacy direct-network routes disabled. Add clear save failure feedback. Persist supported settings across backend restarts with protected server-side credential storage and authenticated settings management. Do not embed the connector deployment operator secret in the frontend. Preserve masking, empty-field behavior and existing credential revocation boundaries. Broader client/workspace permissions follow in Step 4.

**Success test:** Using an authorized session, save supported settings and observe the appropriate successful HTTP response. Reload the browser and restart the backend: settings remain effective. Unauthorized changes fail. Secrets are absent from browser storage, returned configuration, logs and source files. Submitting arbitrary Tally host/port access remains rejected. A failed save is visible to the user and does not report success.

### Step 3 — Correct review periods and summary accuracy

Return explicit `NO_TRANSACTIONS_IN_PERIOD` when a valid selected range has no matching transactions. Reject/report missing and invalid dates at import and review boundaries; remove date fabrication from applicable Tally/Zoho parsing paths. Do not silently replace missing dates with today or a fixed date. Derive the initial review period from valid loaded data; if none exists, require a period or show an explicit empty state. Calculate flagged exposure once per stable transaction within its client, separately from the number of findings. Define signed/absolute exposure consistently and do not sum unlike currencies without an approved conversion policy.

**Success test:** Tests cover valid clean data, an empty selected period, wholly and partly dateless/invalid inputs through actual import paths, unsorted dates and period boundaries. One transaction with three findings contributes its amount once. Different clients' transactions with the same display number remain separate. Data-derived periods replace the hardcoded April 2024 default. Invalid input produces a visible diagnostic, not fabricated accounting data.

### Step 4 — Establish the accounting model and durable workspace

Extend the normalized model only as needed for posting lines, account and party identity, bill allocations, opening balances, source identity/revision, bank records and multi-currency amounts/FX provenance. Store clients, committed accounting records, delivery receipts, versions, review results, snapshots and source-completeness checkpoints durably. Preserve raw-source references with appropriate access/retention controls. Enforce client/tenant authorization on data access and mutations. Make duplicate delivery/version handling transactional. Preserve/restorable snapshot history and separate it from the full change/audit history. Provide schema versioning, tested upgrade behavior and backup/restore instructions; do not claim existing accounting data was migrated if none exists.

This step establishes persistence and model contracts using local fixtures and file imports. It does not implement the TDL watcher, Zoho synchronization, scheduled auditing or live dashboard planned below. Reuse Step 2 settings infrastructure where appropriate.

**Success test:** Save multiple clients, imported records, reports and snapshots. Browser reload and backend restart preserve them. Cross-client unauthorized reads/writes fail. Retrying the same receipt does not duplicate records; changed content using the same receipt ID is rejected. A newer revision supersedes an older one while retaining history; a late older revision cannot revert it. Decimal/currency amounts round-trip correctly. Backup and restore reproduce the saved workspace and its revision history.

### Step 5 — Add and validate accounting review rules

Implement payment-to-bill matching and overpayment checks, unmatched payments, sequence gaps, near-duplicate invoice numbers, duplicate payments, negative cash balances and entries reversed within seven days. Prefer bill allocations/references; otherwise use configurable party/amount/date matching with lower confidence. Scope rules to company, relevant counterparty, voucher type and numbering series/financial period. Do not assume every similar number or gap proves an error.

Add the previously unspecified aggregate definitions: trial-balance checks from complete postings/opening balances; receivable/payable aging from due dates and outstanding allocations; cash-flow and money-movement summaries with documented account classification and internal-transfer treatment; and optional Benford screening only for an explicitly suitable population with adequate sample size and documented thresholds. Benford results are review indicators, not proof of fraud. Configure applicable jurisdiction/tax rules per client rather than applying Indian GST rules to every client.

Implement callable rule evaluation and its evidence outputs here. Scheduled execution and event batching belong to Step 9.

**Success test:** Each rule has seeded positive, legitimate negative, boundary and incomplete-data cases. Explicitly scoped clean fixtures produce the expected zero findings; legitimate round amounts, repeated numbers in different series and valid reversals have documented expected treatment. Negative cash uses opening balances and ordered postings. Partial/missing data yields not-evaluated or lower-confidence outcomes. Reference datasets establish trial balance, aging, money movements and aggregate totals independently of the implementation.

### Step 6 — Import BOC bank statements and reconcile

Implement the BOC consolidated PDF parser with account and currency section tracking, page transitions, Chinese/English layouts, transaction/value dates and running-balance validation. Distinguish transaction rows from balances, summaries and repeated page headers. Use balance changes as validation/evidence for deposit/withdrawal classification rather than blindly treating every number as a transaction. Preserve extraction evidence and mark ambiguity for review. Add the historical FX policy and bank-to-books reconciliation described above using Step 4 storage/model and Step 5 rule interfaces.

The BOC April 2025 PDF has not been supplied or verified. The proposed expected rows — HKD 100.00 rebate on 2025-04-10 and USD 0.38 interest on 2025-04-30 — are provisional until I supply the statement and confirm its contents. Never hardcode those rows or claim a parser passes from that description alone. HKD-to-HKD requires no external rate. Define the USD-to-HKD rate convention and expected rounding before asserting an exact converted result.

**Success test:** After source verification, the April statement produces exactly its independently confirmed transactions and account/currency assignments, with supporting source positions. Opening plus movements agrees with closing balance per account/currency, or an explicit discrepancy is reported. Additional fixtures cover multiple pages/accounts, floating headers, both directions, duplicate imports and missing FX rates. Original amounts remain intact; saved conversion results are reproducible. Reconciliation identifies matched, unmatched and ambiguous items, including supported grouped settlements and legitimate timing differences. Unavailable source PDFs/rates prevent claiming acceptance.

### Step 7 — Add Tally event export and durable ingestion

Validate TDL on the real test installation, preserving normal voucher saving. Export successfully saved creations and alterations to a protected company-scoped XML queue without blocking voucher entry on internet access. Write files atomically, or use a tested complete-file handoff before parsing. Add folder ingestion to the existing connector; a Python helper requires a demonstrated need and the same security/lifecycle boundary. Use startup and periodic sweeps in addition to filesystem notifications, a durable retry queue, bounded backoff, acknowledgements and a quarantine/review path for malformed files. Retain work until backend acknowledgement.

Authenticate the new backend ingestion endpoint and enforce agent/company grants. Use the transaction/event identities defined above. Capture event time, receipt time and revision ordering, retain raw-source provenance and store normalized posting/amount/identity data. Preserve company isolation when users switch companies. Include an authorized initial historical import with masters, balances and allocations required for the monitored period; record incomplete scope explicitly. Establish a handoff between baseline and event capture that neither loses nor duplicates concurrent changes. Test after Windows service restart/reboot and TSplus disconnect/logoff. Document any Tally availability dependency honestly.

**Success test:** Save and edit a voucher in an authorized test company: complete XML reaches the folder, the authenticated connector delivers it, and the correctly versioned transaction/postings appear in the database. Same voucher numbers in two companies stay separate. Duplicate delivery, lost acknowledgement, late revisions, partial files, network interruption and service restart cause neither loss nor duplicate records. Unauthorized/revoked delivery fails. A historical import during ongoing edits converges to the verified source state. Test at least two real companies and confirm Tally remains inaccessible from the public internet. Mock success is insufficient for this real-server gate.

### Step 8 — Reconcile complete exports and detect removals

Implement scheduled company-scoped end-of-day exports and comparison with the stored event stream. Every completed export records company identity, covered history/period, cutoff/source revision, completion evidence and validation totals. Define how concurrent edits and moved voucher dates are handled. Reconcile the agreed historical coverage, including older transactions, rather than only today's date. Do not infer deletion from unavailable/locked companies, failed exports, incomplete files or mismatched scopes. Preserve deletion tombstones/history and distinguish cancellation from deletion and reversal. Where validated, consume explicit TDL deletion/cancellation events as additional evidence.

**Success test:** Delete a current-period voucher and an older voucher within coverage; verified complete reconciliation detects both. Cancel another voucher and record a distinct cancellation outcome. A partial/failed/empty-unverified export causes no false deletions. Changed dates, concurrent edits, missed runs and subsequent recovery converge correctly. An unloaded/inaccessible company reports incomplete coverage. Repeated reconciliation is idempotent and remains company-isolated.

### Step 9 — Wire live timelines and scheduled review

Build the per-client timeline on the durable event/version store. Display creation, modification, cancellation, confirmed deletion, import/reconciliation outcomes and source freshness. Batch eligible event checks per client every 10–30 seconds with a maximum wait; serialize/coalesce overlapping work and make it recoverable. Run aggregate rules every 30 minutes and at configured day close using the client's timezone. Make persisted schedules/checkpoints recover missed work after restart without duplicate runs. Scope WebSocket subscriptions to authorized clients, persist events before publishing and recover missed updates on reconnect.

**Success test:** Under a defined healthy connectivity/load scenario, a successful voucher save becomes visible without refresh within 30 seconds end-to-end. Choose a batch interval that leaves time for delivery, processing and display; measure all timestamps. Fifty saves within the same batch window produce the expected bounded batch count rather than fifty full audits. Sustained traffic cannot postpone auditing indefinitely. Scheduled aggregate/day-close jobs run once for their input revision/window; restart/reconnect recovers missed work and timeline entries. Unauthorized subscriptions reveal no other client's data. Offline delays are visible, not falsely reported as live.

### Step 10 — Complete Zoho collection

Fetch each required resource until the API indicates completion, respecting documented rate limits and retries. Implement protected OAuth token refresh with bounded recovery and clear reauthorization when required. Preserve resource type and stable IDs for invoices, bills, payments, credits, expenses and journals. Fetch required details/allocations/postings and actual tax components instead of guessing them from totals. Correct CGST/SGST/IGST and currency mapping against source evidence. Track checkpoints and completeness per resource and client; a failed resource/page must not yield an unqualified successful complete sync or false deletions. Reuse the durable model and review pipeline. This remains read ingestion, not writing Tally transactions into Zoho.

**Success test:** A test organization with more than 600 records in a resource matches independently verified per-resource counts and control totals for the same scope/cutoff. Compare actual tax components, currencies, payments and allocations with source records. Expired access tokens refresh correctly; revoked refresh credentials request reauthorization. Rate limits, failed middle pages, duplicate pages and interrupted/retried runs do not cause silent truncation or duplication. No resource is labelled complete until verified. Unavailable test credentials/data leave real-provider acceptance pending.

### Step 11 — Deliver reproducible report snapshots

Keep the live dashboard from Step 9 and implement actual downloadable PDF reports alongside Excel. Freeze report data, period, data revision, rule version, FX provenance and completeness as one report snapshot. Include cash-flow/money-movement summaries, transaction changes, findings and reconciliation results appropriate to the selected scope, with clear source/evidence references. Generate on demand and at configured day close, not per event. Authorize access and retain reproducible report history. Preserve existing useful report behavior while replacing reliance on the browser print dialog for the download requirement.

**Success test:** Downloaded PDF and Excel agree with the same frozen dashboard/report revision, counts and monetary totals. Data arriving during generation appears in a later revision, not inconsistently in the current report. Reopening the saved report after browser/backend restart reproduces its values. Verify PDF readability, pagination, Chinese/English text, multi-currency labels and permission checks. No report exposes secrets or another client's data. The live view remains functional while reports generate.

## Protocol rules — non-negotiable

- ONE step at a time. Never implement a future step before I explicitly declare PASS for the current step. Writing this full plan is documentation, not authorization to implement all eleven steps.
- Only I declare PASS after running the success test. Automated green checks, agent review or a successful build are evidence, not my acceptance.
- Start EVERY user-facing reply with `[Step X/11 — status: IN PROGRESS]`, `[Step X/11 — status: WAITING FOR TEST]` or `[Step X/11 — status: FAILED]`, using the actual current step. Do not add an assistant-declared PASS status.
- Use IN PROGRESS while implementing; WAITING FOR TEST when the concrete deliverable is ready for me; FAILED after a failing test, followed by repairs within that same step. Do not advance on silence.
- Every step deliverable ends with exact runnable test commands, any required manual actions and exact expected results. Do not invent commands for scripts that do not exist; create appropriate tests only within the authorized step. Distinguish automated checks, manual acceptance and external-server checks that were not run.
- If I reply FAIL with output, fix the same step. Do not weaken assertions, remove meaningful tests, manufacture fixture outputs, suppress type errors or skip required behavior to obtain a green result.
- No scope creep, unrelated refactors, UI redesign, integrations or migrations. Preserve existing changes and reusable connector infrastructure. An identified prerequisite or contradiction must be explained and agreed before changing this sequence or scope.
- Missing external inputs such as the BOC PDF, authorized credentials or TSplus access are explicit acceptance blockers for the relevant step. Do useful authorized local work, then state what is still unverified. Never call a mock a real connection.
- Keep a concise handoff with current step/status, changed files, executed tests, remaining checks and my last acceptance decision. Do not overwrite an old historical report as if it described the new state.
- If I say NEW SESSION, read this prompt, my last tracker/handoff and the actual repository. Resume the current step without repeating accepted work. If acceptance evidence is absent or conflicts with the working tree, clarify the discrepancy rather than assuming PASS.

## Begin or resume

For a fresh session with no implementation authorization, start with the Step 1 tracker, state `PROTOCOL UNDERSTOOD — STEP 1 READY`, give the narrow plan and the exact tests, and wait for BEGIN. An explicit instruction such as “start Step 1” counts as BEGIN; do not ask for the same authorization again. When resuming, use the recorded current step rather than automatically restarting Step 1.

The current request authorizes drafting this v2 prompt and implementing Step 1 only. After preparing its deliverable, stop at WAITING FOR TEST until I declare PASS.

## Current handoff — 2026-10-07

`[Step 1/11 — status: WAITING FOR TEST]`

- User authorization: rewrite v2 and start Step 1. No user PASS has been received for Step 1; Step 2 has not started.
- Created `docs/master-project-prompt-v2.md` with all eleven review corrections and the eleven-step acceptance protocol.
- Modified only `src/clients/defaultClients.ts` in application source: replaced the obsolete, unused demo-client initializers with a typed empty `INITIAL_CLIENTS` export. `src/App.tsx` already starts empty and was not changed in this step. Shared production types and compiler settings were not relaxed.
- Verification executed: `npx tsc --noEmit` exited 0 with zero errors; `npm run build` exited 0. The build retains existing warnings about `__dirname` in the Vite configuration and a JavaScript chunk larger than 500 kB. Generated files under `dist/` were rebuilt.
- File comparison against the starting working tree found only that source modification and this new document among the 83 tracked/non-ignored files. Existing unrelated working-tree edits were preserved.
- Pending: the user's own command checks and manual confirmation of the empty initial client list. No real Tally, TSplus, provider or future-step acceptance is claimed.

Run these commands from the project root:

```powershell
npx tsc --noEmit
npm run build
npm run dev
```

Expected: the first command exits 0 with no TypeScript errors; the second exits 0 with a production bundle (the documented existing warnings may remain); the third starts the application. Open `http://localhost:3000` (or the configured `PORT`) and confirm that no demo clients are automatically loaded. Stop the development server with Ctrl+C after checking. Reply PASS only after accepting Step 1, or FAIL with the error output/observed behavior. Until then, remain on Step 1.

## Reference evidence

- Existing implementation/runbook: `docs/tally-connector.md`, `server/connector/`, `services/tally-connector/`, `shared/connector/`, `src/normalizer/commonModel.ts`, `src/rules/ruleEngine.ts` and `server.ts`.
- Zoho incoming webhooks: https://www.zoho.com/us/books/help/settings/developer-and-data/incoming-webhooks.html
- Tally events and save/deletion/cancellation behavior: https://help.tallysolutions.com/actions-events-buttons-keys-in-tdl/
- Tally exported company/voucher identifiers: https://help.tallysolutions.com/export-data-faq/
- yfinance project data-use notice: https://pypi.org/project/yfinance/

Future coding sessions must inspect the actual repository and the latest project-state snapshot, if one exists, before making architectural or implementation changes. Do not assume that a requested snapshot was created without checking the filesystem.
