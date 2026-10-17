# D1-first implementation master tracker (updated 2026-10-17)

**Goal:** production-ready D1 as sole active write authority, with PostgreSQL kept as a verifiably current standby and **reversible** switch. This file tracks implementation; it **does not authorize production cutover**.

## Rules that never change

- Both Starpips and Mkety Academy production remain on existing PostgreSQL until all preflight gates pass separately **for each installation**.
- One authoritative writer per installation at a time. No independent dual-active writes.
- No changes to standalone media Worker, media-platform branch, R2 objects, or broadcast playback during database work.
- Never skip reconciliation, active-session draining, rollback verification, data backups or operator approval.
- Each task is complete only with reviewed code, realistic fixtures/integration tests, successful CI, and recorded rehearsal evidence; tests of SQLite fragments alone do not mean the task is done.
- Preserve all existing rows/identifiers and compatibility with running installations. No irreversible automatic downgrade or deletion.

## Status legend
- [x] completed and merged with green CI (limited scope explicitly described)
- [ ] still required, even if some foundation exists

## Implementation checkpoint before PR #149 — 2026-10-17

- Latest local change closes a concrete shared-ID parity bug: newly generated all-active and course-audience enrollment IDs now use the same UTF-8 JSON tuple bytes in PostgreSQL and D1. Explicit claim enrollments use random UUIDs in both implementations. Additive PostgreSQL migration 021 updates only future trigger-generated IDs and preserves existing IDs; it is guarded in the Starpips release workflow and has not been applied to either production database.
- Latest verification: all 654 repository tests pass; TypeScript, full ESLint (0 errors, 4 warnings), Next.js/OpenNext builds, application/media/billing Worker dry-runs, strict vendor-dependency audit, schema coverage (37/37 application tables across 23 PostgreSQL migrations), offline D1 migration rehearsal (21 migrations), SQLite integrity/FK checks and diff checks pass. D1 catalog export reports 37 application tables, 388 columns, 60 indexes, 44 foreign keys, 74 checks and 168 triggers, with no unsupported objects. These are local/offline results, not proof of live PostgreSQL catalog parity or production behavior. Repeated local Next builds exposed a corrupt generated Turbopack cache; the preserved cache copy is outside the repo, and a fresh generated cache passed the build.
- The backend selector now rejects D1 unconditionally until a production authority verifier exists; caller-provided readiness booleans cannot enable it. PostgreSQL remains the only selectable backend.
- Local forward-only migrations 022/0020 define journal, directional checkpoint, idempotent apply-receipt and dead-letter tables. Migrations 023/0021 add disabled-by-default PostgreSQL/D1 capture configuration and row triggers for all 32 application tables; D1 tests prove same-transaction insert/update/delete capture and rollback atomicity, and parity checks block missing event triggers. PostgreSQL capture serializes source write transactions with an advisory lock so journal sequences follow commit order; staging must benchmark the throughput cost. Neither migration pair is in a production release workflow. A read-only journal reader pages by installation/backend/epoch, validates events and ordering, preserves 64-bit sequence values as strings, and caps batches at 500. It does not apply target writes or advance checkpoints. Replay/apply workers, snapshots, source watermarks, reconciliation and live PostgreSQL trigger execution remain unimplemented/unverified.
- Latest local replication work makes D1 atomic batches share a transaction ID: migration 0021 has a temporary `active_transaction_id`, D1 triggers use it when present, and the central D1 repository composition sets/resets it inside the same D1 batch. SQLite integration tests verify shared transaction IDs, distinct idempotency keys and cleanup. This composition remains unused by runtime routes; replay/apply, checkpoints, snapshots, reconciliation, live PostgreSQL capture and authority fencing remain unimplemented/unverified.
- OpenNext build flow is repeatable: the build command removes only its generated Wrangler environment module, Wrangler no longer reruns the explicit OpenNext build, and the Starpips config template matches the committed root config. A local dry-run passed for the app, protected-media and billing Workers. The pre-existing untracked `.open-next/` directory was preserved and restored after these checks.

- At this checkpoint, journal-reader implementation after `9da1ab3` was local. It was subsequently published with the D1 foundation in draft PR #149 and remains unmerged.
- Full-repository lint previously exceeded the local container's 2 GB Node heap; GitHub CI run #1345 completed the full lint step successfully.
- Expanded offline runtime audit: 0 direct PostgreSQL or D1 repository instantiations across app and feature runtime files, including pages, handlers, and server helpers. API routes also have 0 direct constructors. All 19 PostgreSQL repository files pair with 18 D1 files (media playback/progress intentionally share a D1 implementation). Runtime currently makes 154 PostgreSQL-pinned factory calls and has 5 explicit PostgreSQL environment/pool references, all in settings-health, public-live, layout, or integration-status code; no route selects D1. The compatibility inventory's 489 PostgreSQL repository references include imports and explicit PG-pinned factories, so are not 489 direct database accesses.
- TypeScript-AST method inventory finds zero public PostgreSQL repository methods missing from the paired D1 repositories, accounting for inherited methods. This verifies surface coverage only; method behavior, transactional guarantees and side effects still require paired integration tests.
- Strict dependency audit: no active vendor references, 78 narrowly allowlisted historical/audit references, and 0 stale allowlist entries.
- Local D1 migration/SQLite rehearsal passes, but it is not a PostgreSQL catalog comparison. `MKLMS_SCHEMA_AUDIT_DATABASE_URL` is absent and `psql` is unavailable, so complete schema parity cannot be verified here.
- Durable bidirectional replication, strongly consistent per-installation writer fencing, complete D1 runtime integration, backup/restore proof and per-installation staging/rehearsal evidence remain incomplete. Production stays on PostgreSQL. No production Worker, R2 object or live-class resource has been changed.
- D1 runtime selection remains disabled: the pure selector rejects D1 unconditionally because verified fenced authority, replication and rollback services do not exist. PostgreSQL remains the only selectable backend.

## Phase 0 — baseline and protection
- [x] D1-first plan, fail-closed policy, single-authority cutover contract, migration rehearsal, schema/table/column gap audits
- [x] Nonproduction SQLite repositories for access, learning/admin, certificates, quizzes, paid/free live, media/playback/ingest, messages/settings, and managed-hosting usage/invoices/settlement/ledger (local SQLite tests only; not production parity)
- [ ] Lock down full DB object inventory and schema/column/index/trigger/constraint parity across **all** PostgreSQL migrations; offline column inventory passes, but full catalog parity is not proven
- [ ] Verify complete PostgreSQL source state, backups, recovery point objective and per-installation account access without mutating production

## Phase 1 — complete SQLite schema and data semantics
- [ ] Compare all tables and final columns from PostgreSQL migrations 001–024; offline D1 column inventory passes, but exact live catalog/type/constraint/index/default parity is not proven
- [ ] Close migration compatibility gaps (especially deferred lesson/live media foreign keys and ALTER migrations)
- [~] Design reversible mappings for NUMERIC money (USD cents and adjustment sign), timestamps, booleans, JSON and PG-specific types; the offline PG-to-D1 applier has exact cents conversion and basic value normalization, but full semantic mappings remain open
- [ ] Reconcile enrollment ID parity, trigger/event side effects and concurrency under both databases; no unsynchronized enrollment automations

## Phase 2 — real application persistence
- [x] Implement tested *slices* for platform settings, student records, preauthorizations, credentials including atomic rotation, sessions and course-enrollment primitives
- [x] Implement D1 access repository slices including atomic verified claim, login, credential rotation/revocation and session transitions (local SQLite/service tests pass; route runtime still PostgreSQL)
- [ ] Implement complete learning and admin repositories (courses, lesson progress, enrollments, audience assignment, certificates, quiz attempts and paid live)
- [ ] Implement complete live-class repositories (schedule, timeline, viewers, messages, admin controls), respecting unchanged live playback clock
- [x] Implement local D1 persistence for messages, media/playback/progress, settings, and hosting/payment; notification delivery remains provider-side and requires runtime flow verification
- [ ] Ensure every runtime codepath uses the selected backend; runtime call sites now use explicit PostgreSQL-pinned factories, but no durable authority selector or D1 route composition exists
- [x] Add isolated D1 targets and installation-scoped Wrangler bindings while keeping runtime PostgreSQL-only; remote schema migration and parity verification remain in progress

## Phase 3 — reliable single-writer synchronization
- [ ] Specify and implement durable per-installation mutation journal/outbox with strictly monotonic sequence, idempotency, replay, retention and retry/backoff
- [~] Implement PostgreSQL→D1 initial snapshot + incremental sync with consistent watermark and catch-up; transaction replay/receipts/checkpoint foundation exists, but snapshot creation, watermark protocol, and catch-up orchestration remain open
- [ ] Implement D1→PostgreSQL standby apply and failback catch-up with integrity proof; validate ordering, duplicates, interruptions and conflict handling
- [ ] Establish health/readiness indicators: observed sequence lag, schema version, checksums/counts, last successful reconciliation, dead-letter alerts
- [ ] Enforce fenced epochs and **one** write authority with authenticated coordination and rollback; exercise crashes and stale writers

## Phase 4 — proofs and staging rehearsals
- [ ] Automated end-to-end suite on BOTH databases: claim, login, course learning, quizzes, live timeline/chat, media entitlement, progress, certificates, payment/ledger and admin flows
- [ ] Synthetic/data-masked complete snapshot restore; reconcile every table plus representative logical invariants and financial totals
- [ ] Load, concurrency, retries, batch limits and failure-injection tests; compare full interaction semantics
- [ ] Prove PG→D1 and D1→PG switches with no lost acknowledged writes, no duplicate charges, no stale access, acceptable lag and documented expected interruption
- [ ] Stage both installation configurations, verify live-class safe timing and no R2/media modification; log rehearsal artifacts

## Phase 5 — **separate gated production decision**, not part of automatic development deployment
- [ ] Independent signoff and current verified backups for Starpips and Academy
- [ ] Confirm no active live class/cutover-sensitive transaction; freeze or drain writes with a measurable fence
- [ ] Confirm standby at exact durable watermark and per-table reconciliation success, then switch one installation first under monitored canary
- [ ] Document immediate rollback to PG, rollback trigger thresholds, escalation contact and follow-up reconciliation
- [ ] Repeat for second installation only after first is stable; retain PG as tested standby

## Current checkpoint
As of 2026-10-17, implementation is in draft PR #149 at `feat/d1-cutover-implementation-20261017`; it is not merged. Two new empty D1 targets were created in the configured Cloudflare account for Starpips and Mkety Academy; their IDs are in the installation manifests. The PR config binds those databases and applies the reviewed D1 schema migrations, but does not deploy Workers, change production PostgreSQL, or route application traffic. PostgreSQL remains the only runtime-selected backend. Current local evidence: 683 tests pass; TypeScript, focused ESLint, and `git diff --check` pass; strict vendor dependency audit reports zero active references and zero stale allowlist entries. The D1 offline rehearsal applies 22 migrations with 52 required indexes and 168 triggers; SQLite integrity and foreign-key checks pass. Offline coverage finds 37/37 application tables across 24 PostgreSQL migrations, and column parity passes 37/37 tables. These are local/offline results, not proof of live catalog parity or application behavior.

The PostgreSQL journal reader returns one transaction at a time and rejects a cursor that splits one. A new offline-only D1 applier foundation transactionally applies PostgreSQL journal entries, receipts and checkpoint advancement; tests cover replay idempotency, rollback, exact decimal-to-cents conversion, and suppression of source-derived enrollments. PostgreSQL 024 and D1 0022 add an apply-mode guard while retaining integrity checks. This is still not connected to app runtime and does not establish initial snapshots, bidirectional replication, reconciliation, or writer fencing. The Starpips release migration guard allows only the known deferred 022–024 tail and refuses to proceed if a deferred or unknown migration is recorded; it continues to apply only 018–021.

In prior CI run [#39073191452](https://github.com/MketyDigital/mklms/actions/runs/39073191452), the read-only audit found zero visible D1 databases and zero deployed Worker bindings. The follow-up provisioning job [#39073947212](https://github.com/MketyDigital/mklms/actions/runs/39073947212) created the two exact-name empty databases. The next guarded CI run will apply the reviewed D1 migrations and capture the schema-only catalogs; their results must be recorded before claiming live schema readiness. No production PostgreSQL catalog could be captured because DNS returned `EAI_AGAIN`. No application rows were read. D1 runtime remains disabled, and live PostgreSQL-to-D1 parity, snapshots, reverse apply/failback, reconciliation, backup/restore, staging, and authority fencing remain open. **Both production installations remain on PostgreSQL.** Phase 5 is blocked until all proofs pass and each installation has separate cutover approval.

## Execution order from this checkpoint
1. [x] Finish D1 persistence slices through managed hosting; commit `8c3ae41`.
2. [x] Strengthen offline D1 catalog/integrity rehearsal; commit `c4a8724`.
3. [~] Add fixture-driven full-object parity comparison and catalog exporters; type/money normalization, structural index/FK comparison, expression indexes, partial predicates and basic CHECK normalization exist. Default normalization is partial; trigger semantic comparison and actual isolated-PG comparison remain open.
4. [ ] Finish schema semantic mappings and address confirmed migration/catalog differences with forward-only D1 migrations.
5. [~] Create installation-scoped D1 targets, wire Wrangler bindings, and apply schema-only migrations; verify live catalogs against PostgreSQL after connectivity is restored.
6. [ ] Complete shared repository contracts and explicit D1 runtime composition, then migrate route/job/webhook call sites behind one selected backend.
7. [ ] Prove complete application behavior on local D1 and isolated PostgreSQL; keep live routing PostgreSQL-only until proven.
8. [~] Add journal/checkpoint/receipt/dead-letter schema and transactionally capture mutations; PG→D1 transaction replay foundation exists, but snapshot, reverse apply, and reconciliation remain open.
9. [ ] Implement strongly consistent authority epochs and enforce the write gate across every mutating entry point.
10. [ ] Add health, restore, runbook, staging, failure-injection and per-installation rehearsal evidence.
11. [ ] Only after all prior evidence, evaluate separately gated Starpips and Academy cutovers; this tracker does not approve either switch.
