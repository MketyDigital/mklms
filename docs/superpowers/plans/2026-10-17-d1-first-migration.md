# MkLMS D1-First Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make D1 the proven sole active database for each MkLMS installation after an explicitly gated cutover, retain PostgreSQL as a synchronized reversible standby, and remove all active Supabase dependencies.

**Architecture:** Preserve existing domain contracts and PostgreSQL repositories while completing D1 repositories and a verified backend selector. Add durable ordered replication and a strongly consistent per-installation write fence; cutover is impossible until both application paths and both replication directions pass staging proofs.

**Tech Stack:** TypeScript, Next.js/OpenNext, Cloudflare D1/SQLite, PostgreSQL over isolated Hyperdrive, Node.js built-in test runner, GitHub Actions.

**Spec:** [2026-10-17-d1-first-migration-design.md](../specs/2026-10-17-d1-first-migration-design.md)

## Global Constraints

- PostgreSQL remains production authority until all schema, runtime, replication, fencing, backup, staging, and per-installation approval gates pass.
- D1 is the only writer after a successful cutover; PostgreSQL is standby only. Never use independent dual writes or timeout failover.
- Starpips and Mkety Academy remain isolated and are cut over separately.
- Preserve existing behavior and all approved changes, including PR #148 hosting/certificate schema parity.
- Do not change historical PostgreSQL migrations, production pointers, live Workers, secrets, R2 media, or live-class playback during engineering.
- Remove all active Supabase dependencies from code, packages, configuration and operations; preserve only narrowly documented historical/audit references where deletion would erase provenance.
- Every claimed gate requires executable integration or end-to-end evidence, not only SQL parsing or offline fragments.

## Review Focus

- Concurrent requests attempt to claim one preauthorization; exactly one complete claim must commit.
- A crash or timeout during replication must resume idempotently without losing acknowledged changes or duplicating financial effects.
- A stale writer or stale authority epoch must be rejected across HTTP, webhooks, scheduled jobs and admin flows.
- Type conversion at money, timestamp, JSON, boolean, ID and null boundaries must round-trip exactly.
- Supabase strings may remain only in explicitly allowlisted historical/audit material; runtime, build, release, secrets, and deployment must not require them.

---

### Task 1: Establish the complete repository baseline and preserve pending work

**Files:**
- Create: `docs/d1-audit-baseline-2026-10-17.md`
- Create: `scripts/audit-d1-runtime-coverage.mjs`
- Create: `tests/d1-runtime-coverage-audit.test.mjs`
- Inspect: all `src/`, `db/`, `deploy/`, `.github/workflows/`, `scripts/`, `package.json`, lockfile, environment examples, generated configs, migration ledger, and production release workflows.

**Interfaces:**
- Produces an inventory of database calls by route/service/repository, database objects by migration, all Supabase references classified by active/historical status, existing test coverage, and deployment/resource boundaries.
- The audit must be read-only and must not contact production, Cloudflare, Supabase, or PostgreSQL.

- [ ] Add tests asserting the audit covers runtime routes, scheduled/webhook entry points, manifests/workflows, dependencies, and all Supabase reference classes.
- [ ] Run the audit against the full repository and record precise files/lines plus gap categories in the baseline.
- [ ] Confirm existing production release workflows still use isolated Starpips and Academy pointers and PostgreSQL bindings.
- [ ] Verify the schema change in PR #148 and its check results; merge it only after verifying expected-head SHA and required checks, then record the merge SHA. If its status changed or checks are incomplete, stop that task and preserve it open.

### Task 2: Make schema parity executable and complete

**Files:**
- Modify: `scripts/d1-column-parity.mjs`
- Modify: `scripts/d1-schema-coverage.mjs`
- Modify: `scripts/d1-rehearse-migrations.mjs`
- Create: `scripts/d1-schema-parity.mjs`
- Create: `scripts/d1-data-codecs.mjs`
- Create: `tests/d1-schema-parity.test.mjs`
- Create: `tests/d1-data-codecs.test.mjs`
- Add D1 migrations after `0015` in `db/d1-migrations/` for every verified gap from PostgreSQL migrations 001–020.

**Interfaces:**
- `buildSchemaParityReport(pgSchema, d1Schema): SchemaParityReport` lists every object mismatch and unsupported source construct; strict mode exits nonzero on any mismatch.
- `encodePgValue(type, value): SqliteValue` and `decodeSqliteValue(type, value): PgValue` implement reversible mappings for money, timestamps, booleans, JSON, IDs and NULLs.

- [ ] Write failing fixtures for table/column additions and drops, indexes including partial/unique, checks, foreign keys, triggers, defaults, migration renames, and PostgreSQL-only constructs.
- [ ] Apply PG migrations 001–020 to an isolated PostgreSQL test database and D1 migrations to in-memory SQLite; compare catalog objects, not migration text alone.
- [ ] Add only forward D1 migrations for verified gaps; preserve all existing data and key relationships.
- [ ] Add round-trip property fixtures for numeric money signs/precision, timestamps/timezones/precision, booleans, JSON, IDs, and nullable values.
- [ ] Run `node scripts/d1-rehearse-migrations.mjs`, `node scripts/d1-schema-parity.mjs --require-complete`, and `npm test`; all parity differences must be zero or explicitly unsupported and blocking.

### Task 3: Remove active Supabase dependency paths

**Files:**
- Modify active runtime/config/workflow/package files identified by Task 1.
- Create: `scripts/audit-no-supabase.mjs`
- Create: `tests/no-supabase-audit.test.mjs`
- Modify: `.github/workflows/verify.yml` or the canonical verification workflow identified by the audit.
- Update active deployment and environment documentation to PostgreSQL/Hyperdrive plus D1 only.

**Interfaces:**
- `auditSupabaseReferences(root): { active: Finding[]; historical: Finding[]; allowlisted: Finding[] }` fails on active references and rejects unrecognized allowlist entries.
- No production secret is read, rotated, printed, or deleted by this audit/removal.

- [ ] Inventory every Supabase reference across runtime, auth, data/storage, package/lock, workflows, deployment, manifests, generated types, docs and scripts; classify exact reference and behavior.
- [ ] Write tests proving active imports, dependencies, environment variables, workflow actions, and setup instructions fail the audit.
- [ ] Replace any required active path with the approved isolated Hyperdrive PostgreSQL or D1 implementation while preserving behavior and secrets.
- [ ] Remove unused Supabase package dependencies, clients, generated artifacts and active configuration only after call-site tests pass.
- [ ] Add narrow explicit historical-reference allowlist with rationale and tests; do not allow broad directory or wildcard suppression.
- [ ] Run `npm test`, lint, Next production build, OpenNext Cloudflare build, Worker packaging dry-runs, and the strict audit; verify no Supabase access or credentials are needed.

### Task 4: Complete D1 persistence and runtime backend selection

**Files:**
- Extend `src/features/*/repositories/` with D1 implementations corresponding to every PostgreSQL repository.
- Modify: `src/lib/database-backend-policy.ts`, `src/lib/d1-query-adapter.ts`, installation config/materialization and runtime composition.
- Create shared integration suites under `tests/` for access, courses, certificates, quizzes, live, media/playback, messages, settings, notifications and hosting/settlement.

**Interfaces:**
- Implement each existing repository interface as `D1<Name>Repository`; retain `Postgres<Name>Repository` without semantic changes.
- `createDatabaseRepositories(env, installation): Promise<Repositories>` selects exactly one backend and validates the installation-scoped binding, schema version, and authority.
- All multi-row state transitions use one D1 atomic batch/constraint boundary; failures surface without cross-backend fallback.

- [ ] Add shared contract tests that execute against a local PostgreSQL test instance and SQLite/D1-compatible adapter with the same fixtures and expectations.
- [ ] Implement complete access claim, login, credential rotation/revocation, and session transitions; assert concurrent verified claims produce one credential/enrollment outcome.
- [ ] Implement course/admin, progress, audience, certificate, quiz, paid-live, free-live timeline/chat, messaging, media entitlements/progress, settings/notifications, and hosting/payment repositories.
- [ ] Test exact event/trigger side effects, stable IDs, idempotency, enrollment parity, payment-ledger totals, protected-media authorization, and unchanged live playback-clock semantics.
- [ ] Cover all route/job/webhook write call sites from Task 1; fail CI for any D1-mode path that reaches unguarded PostgreSQL SQL or an incomplete repository.
- [ ] Keep PostgreSQL the only production backend during this task. Run the full functional test matrix on both database implementations.

### Task 5: Implement durable bidirectional replication

**Files:**
- Create: `src/lib/replication/types.ts`
- Create: `src/lib/replication/journal.ts`
- Create: `src/lib/replication/postgres-source.ts`
- Create: `src/lib/replication/d1-source.ts`
- Create: `src/lib/replication/apply.ts`
- Create: `src/lib/replication/reconcile.ts`
- Create: `scripts/replication-rehearsal.mjs`
- Create: `tests/replication-*.test.mjs`

**Interfaces:**
- `appendMutation(input): Promise<JournalRecord>` records installation, sequence, schema version, entity, key, operation, payload/tombstone and idempotency key in the same source commit.
- `replayThrough(target, watermark): Promise<ReplayCheckpoint>` applies ordered changes idempotently and acknowledges only after durable apply.
- Both directions use the same entity semantics and codecs from Task 2.

- [ ] Test sequence monotonicity per installation, duplicate delivery, idempotency, deletes/tombstones, transaction rollback, retries/backoff, dead letters and restart after interruption.
- [ ] Build consistent snapshot plus watermark for initial PG→D1 and D1→PG copies; verify resume after partial batches and bounded D1 batch sizes.
- [ ] Prove no acknowledged source write is omitted and critical financial/access transitions are never duplicated.
- [ ] Add per-table count/key/hash reconciliation plus domain invariants for enrollment, credentials, payment/settlement totals, progress and active live state.
- [ ] Run synthetic-data replay in both directions under concurrency and injected source/target failures; block promotion if any mismatch or lag is unaccounted.

### Task 6: Enforce one writer with real authority fencing

**Files:**
- Create: `src/lib/authority/authority-store.ts`
- Create: `src/lib/authority/write-gate.ts`
- Create: `src/lib/authority/cutover.ts`
- Modify: all write entry points identified by Task 1.
- Create: `tests/database-authority-fence.test.mjs`

**Interfaces:**
- `getAuthority(installationId): Promise<AuthorityRecord>` returns backend, epoch, phase and observed checkpoint from a strongly consistent store.
- `authorizeWrite(installationId, backend, epoch): Promise<WritePermit>` must atomically reject standby and stale-epoch writers before mutation.
- `fenceAndSwitch(input): Promise<CutoverResult>` requires the final source watermark, drained writes, verified target reconciliation, healthy rollback target and explicit approval evidence.

- [ ] Select and document a strongly consistent authority primitive with atomic conditional updates; do not use eventually consistent KV or environment toggles as sole fencing.
- [ ] Test parallel epoch changes, stale isolates, retry after timeout, process crash in each phase, and stale HTTP/cron/webhook/admin writes.
- [ ] Enforce the gate in every mutation entry point and prove a request cannot mutate after losing its epoch.
- [ ] Keep scheduler/webhook writes drained or fenced while switching; continue read-only media delivery and do not alter live playback state.
- [ ] Verify incomplete proof keeps the source writer selected and all target writes rejected.

### Task 7: Add operational visibility, backup/restore, and staging rehearsals

**Files:**
- Create: `src/lib/replication/health.ts`
- Create or modify: admin/operator-only diagnostics and installation-scoped deployment bindings.
- Create: `docs/d1-cutover-runbook.md`
- Create: `tests/d1-cutover-runbook-contract.test.mjs`
- Create sanitized staging evidence files under `docs/d1-rehearsals/`.

**Interfaces:**
- Health reports expose per-installation backend/epoch, schema version, source and target watermarks, lag, last reconciliation, dead-letter count, and readiness.
- Runbook specifies backup restore, source fencing, catch-up, switch, validation, rollback triggers and named operator duties; secrets and personal data are excluded.

- [ ] Provision isolated nonproduction D1 and PostgreSQL test/staging targets per installation; validate configuration without production writes.
- [ ] Restore masked/synthetic full snapshots and verify every table plus critical domain and financial invariants.
- [ ] Exercise load, concurrency, rate/batch limits, slow target, network interruption, crash/restart, replay backlog and recovery.
- [ ] Rehearse PostgreSQL→D1 and D1→PostgreSQL for Starpips and Academy independently; record exact source/target watermarks, lag, downtime, test results and recovery times.
- [ ] Confirm existing domains, Workers, R2 objects, media delivery and live-class playback are unchanged by staging rehearsal.

### Task 8: Final release verification and separate production cutover gates

**Files:**
- Update: `docs/D1_FIRST_IMPLEMENTATION_MASTER_TRACKER.md`
- Update: `docs/D1_FIRST_MIGRATION_AND_POSTGRES_BACKUP_PLAN.md`
- Update: `docs/DUAL_BACKEND_CUTOVER_CONTRACT.md`
- Update: per-installation release workflows only if necessary to add fail-closed preflight; never auto-promote pointers.

- [ ] Run full unit/contract/end-to-end suites, strict schema parity, Supabase audit, lint, Next/OpenNext builds, all Worker packaging dry-runs, CodeQL and installation validation.
- [ ] Obtain fresh verified backup and restore result for each installation, prove standby checkpoint equality, confirm a class-free window and publish rollback trigger thresholds and escalation path.
- [ ] Require independent explicit production approval for the specific installation and exact planned switch window; never treat CI success or this plan approval as production switch approval.
- [ ] Switch one installation only through the fenced runbook, verify user-facing auth/course/live/media/payment behavior, and retain PostgreSQL as synchronized standby; repeat for the other installation only after the first is stable and separately approved.
- [ ] Reconcile after switch and after any rollback, record evidence, update tracker truthfully, and stop immediately on any lost write, mismatch, stale access, duplicate settlement, authority ambiguity, or protected-resource change.

## Self-review gaps and boundaries

- The remote repository must be checked out locally on an isolated implementation branch before code changes; the current workspace is not a repository checkout.
- Task 1 determines exact route/repository file coverage before Tasks 3–6 mutate runtime; discovered routes must be added to the coverage matrix, not silently omitted.
- Production cutover cannot be inferred from green tests. It remains separately gated per installation by current backups, measured staging evidence, explicit approval and a controlled operational window.
