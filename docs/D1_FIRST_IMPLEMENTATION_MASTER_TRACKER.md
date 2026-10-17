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

## Phase 0 — baseline and protection
- [x] D1-first plan, fail-closed policy, single-authority cutover contract, migration rehearsal, schema/table/column gap audits
- [x] Nonproduction SQLite foundations for core students, learning, live, messaging, playback, hosting, quizzes and settlement
- [ ] Lock down full DB object inventory and schema/column/index/trigger/constraint parity across **all** PostgreSQL migrations; run `node scripts/d1-column-parity.mjs --require-complete` green
- [ ] Verify complete PostgreSQL source state, backups, recovery point objective and per-installation account access without mutating production

## Phase 1 — complete SQLite schema and data semantics
- [ ] Cover all tables and final columns from PostgreSQL migrations 001–020; include indexes, unique/partial indexes, CHECKs, FKs, JSON, time precision and sequences/defaults
- [ ] Close migration compatibility gaps (especially deferred lesson/live media foreign keys and ALTER migrations)
- [ ] Design reversible mappings for NUMERIC money (USD cents and adjustment sign), timestamps, booleans, JSON and PG-specific types; test with edge-case fixtures
- [ ] Reconcile enrollment ID parity, trigger/event side effects and concurrency under both databases; no unsynchronized enrollment automations

## Phase 2 — real application persistence
- [x] Implement tested *slices* for platform settings, student records, preauthorizations, credentials including atomic rotation, sessions and course-enrollment primitives
- [ ] Implement complete D1 AccessRepository: **one atomic verified claim** covering preauth/student/credentials/enrollment, login, credential rotation, revocation and session transitions; exercise entire service/route contract
- [ ] Implement complete learning and admin repositories (courses, lesson progress, enrollments, audience assignment, certificates, quiz attempts and paid live)
- [ ] Implement complete live-class repositories (schedule, timeline, viewers, messages, admin controls), respecting unchanged live playback clock
- [ ] Implement complete message, media, playback grant/progress, settings, notification and hosting/payment repositories
- [ ] Ensure every runtime codepath uses the selected backend; remove unguarded direct PostgreSQL access in D1 mode
- [ ] Make D1 binding/installation config explicit, optional until ready and fail-closed; preserve PG-only live runtime

## Phase 3 — reliable single-writer synchronization
- [ ] Specify and implement durable per-installation mutation journal/outbox with strictly monotonic sequence, idempotency, replay, retention and retry/backoff
- [ ] Implement PostgreSQL→D1 initial snapshot + incremental sync with consistent watermark and catch-up
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
As of 2026-10-17, PR #146 merged. **D1 is not the active production backend.** The sliced stores are not yet a complete running D1 application and the bidirectional synchronization engine has not been delivered. Phase 5 is blocked until the preceding checklists and evidence are complete.
