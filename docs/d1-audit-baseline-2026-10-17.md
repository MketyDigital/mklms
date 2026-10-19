# MkLMS D1 migration audit baseline

**Captured:** 2026-10-17
**Audit mode:** local, read-only repository inspection; no production database, Cloudflare API, D1, PostgreSQL, or R2 connection was opened.
**Implementation base:** `main` after PR #148, merge commit `b8c6cb65d7a9d40a751f1ce13914920d3f054d00`.

## Current application and database state

- PostgreSQL is still the application runtime database. The D1 query adapter explicitly says it is not connected to runtime query handling.
- The repository has **65 API route files**, **19 PostgreSQL repositories**, and **5 D1 stores** (four access stores and platform settings). The read-only inventory found **369 PostgreSQL-related source references across 107 files**. This is not a complete D1 application backend.
- There are **20 PostgreSQL migrations** (001–020) and **19 D1 migrations** (0001–0019). The D1 migration rehearsal applies all 19 migrations in SQLite and passes integrity and foreign-key checks.
- The effective schemas contain **32 PostgreSQL tables** and **32 D1 tables** after applying migration drops. The scanner reports table-name coverage only, not complete schema parity.
- `node scripts/d1-column-parity.mjs --require-complete` now passes its offline column inventory after excluding dropped legacy tables and declaring the six verified USD-to-cents mappings. This is still not catalog-level parity: indexes, checks, triggers, defaults, types, and unsupported PostgreSQL constructs are not fully compared.
- `src/lib/database-backend-policy.ts` and `src/lib/database-cutover-contract.ts` remain helper contracts, not runtime routing, a distributed writer fence, or a replication system. No durable bidirectional mutation journal was found.

## Supabase inventory

There are **85 textual matches** in the inspected file set. The active integration is real and must be migrated before a zero-Supabase end state:

- `deploy/installations/mkety-academy.json` names a Supabase-hosted PostgreSQL origin.
- `.github/workflows/deploy-mkety-installation.yml` and `.github/workflows/provision-mkety-installation.yml` construct or provision Academy DB connectivity from that origin.
- `.github/workflows/mkety-academy-release.yml` documents the existing Supabase schema as pre-migrated.
- `scripts/prepare-installation-proposal.mjs` seeds the same origin into new proposal output.
- `src/features/settings/platform-settings.ts`, `src/app/api/admin/settings/platform/route.ts`, and `src/features/settings/integration-status.ts` still expose or describe Supabase as a storage/database provider.
- Operator instructions in `docs/deployment/cloudflare-hyperdrive.md`, `docs/deployment/database-migrations.md`, `docs/deployment/environment-variables.md`, `docs/operations/github-free-private.md`, and `docs/D1_FIRST_MIGRATION_AND_POSTGRES_BACKUP_PLAN.md` still describe Supabase setup or use.
- Older specs/plans and tests include historical workflow decisions and fixtures. Those need an explicit decision: update active test expectations, and retain or archive historical provenance without allowing it to drive builds, releases or operations.

The audit classifies 1 active manifest/config reference, 4 active workflow lines, and 3 active runtime lines. Other matches include audit tools, historical plans/specs, operator docs, tests, and repository guidance. The full file/line inventory is produced by `node scripts/audit-d1-runtime-coverage.mjs`.

The requested target is Mkety's isolated self-hosted PostgreSQL/pgvector service behind Hyperdrive, not the current Supabase host. No `DATABASE_URL`, `MKETY_DATABASE_URL`, `MKETY_DB_URL`, `STARPIPS_DATABASE_URL`, or Hyperdrive bindings were present in the local environment. The target host, schema/role, credentials, backup state, current data, and Hyperdrive origin therefore remain unverified; no host or secret was guessed or changed.

## Production release boundaries

- `production/starpips` and `production/mkety-academy` remain independent pointers. At audit time their remote refs were `00e2a71b6391b592c7c839408b28c2f68a0386f6` and `b4dd2c426eaf1d3672e09caae0c400759d3b649d`, respectively.
- No production pointer, application/media Worker, Hyperdrive origin, secret, database, R2 object, or live-class setting was changed.
- Academy's separate deployment/provision workflows can mutate Worker/R2/Hyperdrive resources when manually invoked. They must be revised and re-proven before the old Supabase endpoint is removed.

## Baseline verification

- Before PR #148 was merged and before this audit test was added, the existing repository suite passed **525 tests, 0 failures**.
- After merging PR #148 and adding the read-only audit test: `npm test` passed **527 tests, 0 failures**.
- `npm run lint` exits 0 with **0 errors and 4 warnings** (three unused imports in `src/app/api/admin/media/direct-upload/abort/route.ts`; one anonymous default export in `workers/billing/src/index.ts`).
- `node scripts/d1-rehearse-migrations.mjs` passes offline and reports all 15 D1 migrations applied with foreign-key check passed.
- `node scripts/d1-schema-coverage.mjs --require-complete` passes table-name coverage. This is not proof of column/object/type parity.
- `npm ci` cannot run because the repository has no committed package lock. `npm install` succeeds and is what the GitHub workflows currently use; its generated lockfile was discarded as an audit artifact.

## Task 1 disposition

- PR #148 was checked at head `fd00f5c50cccd5eaf77151970c4c982c2c80c4da`; its verification, Cloudflare preview builds and CodeQL checks were green, and GitHub reported it mergeable. It was squash-merged to `main` as `b8c6cb65d7a9d40a751f1ce13914920d3f054d00` and included in this audit branch.
- Repository baseline and Supabase/runtime inventory are now reproducible with the new offline audit script and test.
- This task does not establish D1 runtime readiness, replication, rollback safety, or production cutover readiness.

## Schema behavior requiring application parity

- PostgreSQL migration 016 installs `mklms_students_all_active_course_enrollment`, which activates or restores an enrollment when a student becomes active and the course audience is `ALL_ACTIVE_STUDENTS`. It serializes activation and audience changes with `pg_advisory_xact_lock`.
- D1 migration 0012 creates `assignment_mode`, its check, and the index but intentionally has no trigger. `src/lib/d1-all-active-enrollment.ts` only enrolls one student in one course; its own comment says enumeration, membership coordination, and the full transaction remain the caller's responsibility.
- The initial audit identified the missing D1 behavior. D1 now has `D1AccessRepository` and `D1CourseAudienceRepository` implementations that update student/course state and enroll all active students in the same atomic batch. D1 derives new enrollment primary keys deterministically from the student/course/scope JSON tuple inside SQLite, avoiding a read-then-write race. Existing row IDs are retained, and no foreign-key/reference use of `enrollments.id` was found in the repository. SQLite integration tests cover parallel claims, concurrent activation/audience changes, completion preservation and rollback. This is local SQLite evidence; Cloudflare D1 runtime integration still needs rehearsal.
- The D1 ID encoding for new enrollments is not byte-identical to PostgreSQL's MD5 expression. Replication must copy the persisted row ID as data and never recalculate it on the target. Existing D1 and PostgreSQL row IDs are not rewritten.

## 2026-10-17 implementation checkpoint

> **Checkpoint refresh:** The original baseline below records the audit-time counts and is retained as historical evidence. The active implementation checkpoint is maintained in `docs/D1_FIRST_IMPLEMENTATION_MASTER_TRACKER.md` and the SDD progress ledger. At the latest local checkpoint, 19 D1 migrations rehearse successfully; D1 catalog export reports 32 tables, 343 columns, 55 indexes, 44 foreign keys, 45 checks and 72 triggers, with no unsupported SQLite catalog objects. The full test suite passes 608 tests. A PostgreSQL catalog snapshot is still unavailable, so this is not cross-database schema parity evidence.

- Added local D1 access and admin access repositories plus course audience persistence. SQLite tests exercise complete claim/login, claim races, atomic rollback, credential/session lifecycle, reclaim, student status transitions, audience replacement and concurrent activation/audience updates.
- D1 migration 0016 adds an assertion table for deliberate rollback when a multi-statement batch fails an invariant. Migration 0017 mirrors PostgreSQL's all-active enrollment trigger for student insert/activation while retaining existing enrollment IDs.
- Verification at this checkpoint: 18 targeted D1 repository tests passed; full `npm test` passed 555 tests; `npm run build` passed. These are local SQLite and Next build checks. Cloudflare D1, OpenNext packaging, PostgreSQL integration and runtime backend composition are not yet proven.
- Added `D1LearningRepository` for course structure, enrollments, quiz gates, lesson completion, monotonic video progress and course completion. Its service-contract tests pass on migrated SQLite, including manual and video completion behavior. After this addition, full `npm test` passes 557 tests and both `npm run build` and `npm run cf:build` pass.
- Added D1 certificate and template repositories for issuance, verification, delivery metadata, revocation/restoration, template selection, and single-active-template changes. SQLite tests cover concurrent/idempotent issuance, locked identity/completed enrollment, public verification states, course-specific template precedence, and delivery metadata. Current full suite passes 561 tests and `npm run build` passes.
- Added `D1AdminLearningRepository` for course/module/lesson CRUD, publication status, position allocation, and history-protected deletions. SQLite behavior tests pass; full suite passes 564 tests, production build passes, and lint passes for this implementation.
- Added `D1QuizRepository` for quiz reads/admin changes, atomic question/choice creation and attempt/answer persistence, history-aware delete rules, and passed-quiz gates. Tests verify transactional rollback on invalid attempt answers. Full suite now passes 568 tests; Next and OpenNext builds and lint for new D1 repositories pass.
- Added `D1SettingsRepository` implementing the application `SettingsRepository` contract over the existing D1 singleton store, preserving PostgreSQL default and legacy normalization behavior. Settings tests pass; full suite passes 571 tests and Next build passes.
- Added D1 message persistence for per-student threads, ordered student/admin messages, contextual admin replies, read markers, unread thread state, and student lookup. SQLite tests cover simultaneous get-or-create, ordering, unread transitions, and FK failure. Full suite passes 574 tests and Next build passes.
- Added `D1PaidLiveRepository` for paid course session scheduling, delivery-mode field normalization, enrollment-gated student listings, and media asset lookup. Full suite passes 577 tests; Next and OpenNext Cloudflare builds pass; lint passes on the new repository.
- Added `D1MediaPlaybackRepository` for course-bound protected-media lookup, playback grants, credible watch totals, and atomic progress-plus-watch-credit persistence. Service-level tests cover entitlement bounds and rollback of both writes together. Full suite passes 580 tests; Next and OpenNext Cloudflare builds pass; lint passes on the implementation.
- Added D1 free-live public room and admin repositories for unchanged session-clock reads, timeline imports, viewer heartbeats/counts, attendee chat visibility/read state, and batch/session administration. Timeline replacement runs as one D1 batch and was tested with a multi-chunk replacement and rollback on invalid data. Full suite, Next build, OpenNext build, and focused lint pass.
- Added D1 admin media and media ingest repositories for catalog persistence and ingest estimates/state metadata, with exact string storage for estimated USD and asset-delete FK cleanup. Tests verify ingest validations, state constraints, dependent metadata nulling, playback-grant cascades and no R2 object mutation.
- Added D1 managed-hosting policy, usage, monthly invoice, settlement and daily ledger repositories. Monetary values are integer cents, invoice finalization/settlement preserve idempotency, and daily snapshots preserve the same-version automatic-balance peak. Focused tests cover month usage windows, baseline live minutes, reconciliation, policy limits, settlement replay and ledger adjustment/version behavior.
- The offline D1 migration rehearsal now also validates SQLite `integrity_check`, foreign keys, the expected critical indexes and both active-student enrollment triggers against the materialized SQLite catalog. It remains an internal D1 integrity check and does not compare with a live PostgreSQL catalog.
- SQLite accepts NULL in non-INTEGER primary-key columns unless separately guarded. D1 migration 0018 adds fail-closed insert/update triggers for every text primary key; the offline rehearsal verifies both guards for all such columns, and tests reject NULL student IDs without table rebuilds or row changes.
- PostgreSQL's deferred lesson and live-session media asset references are now represented by D1 migration 0019 validation and delete triggers. Catalog export records these as verified trigger-backed SET NULL foreign keys only when all six guards exist; tests cover invalid references and asset deletion.
- Added normalized catalog comparison fixtures and exporters. `scripts/export-d1-schema-catalog.mjs <file>` exports D1 migration metadata from an in-memory SQLite database. `scripts/export-postgres-schema-catalog.mjs <file>` requires the explicitly named `MKLMS_SCHEMA_AUDIT_DATABASE_URL`, sets PostgreSQL read-only mode, and exports metadata only. Column type mappings cover UUID/text, integer, boolean/integer, timestamp/text, JSON/text and documented money cents fields. Indexes and foreign keys are matched structurally rather than by generated constraint names; expression indexes and any unparsed CHECK expressions are explicitly marked unsupported. No PostgreSQL URL was available in this workspace, so no live PostgreSQL catalog snapshot or parity result exists; default, index predicate and check/trigger expression normalization remain open.
- Latest local verification: full `npm test` passes **596 tests**; `npm run build`, `npm run cf:build`, and focused ESLint checks pass. These are local SQLite, lint and build checks only; no Cloudflare D1 or PostgreSQL service was contacted.
- Runtime still constructs PostgreSQL repositories directly in API route handlers. The codebase has **18 D1 repositories and 19 PostgreSQL repositories**, but the D1 coverage is incomplete for existing domains and the D1 repositories are not runtime-selected. The D1 adapter itself remains explicitly disconnected from runtime query handling. Remaining D1 domains, complete catalog parity, Cloudflare D1 integration, PostgreSQL integration, durable replication, durable authority fencing, backup/restore and staging rehearsal remain blockers. PostgreSQL remains the only production backend.

## Complete Supabase file/line inventory

| Classification | File | Lines |
|---|---|---|
| active-workflow | .github/workflows/deploy-mkety-installation.yml | 15, 69 |
| active-workflow | .github/workflows/mkety-academy-release.yml | 29 |
| active-workflow | .github/workflows/provision-mkety-installation.yml | 21 |
| repository-guidance | agentmklms.md | 33 |
| repository-guidance | AGENTS.md | 117 |
| active-config | deploy/installations/mkety-academy.json | 28 |
| operator-documentation | docs/D1_FIRST_MIGRATION_AND_POSTGRES_BACKUP_PLAN.md | 17, 43 |
| operator-documentation | docs/deployment/cloudflare-hyperdrive.md | 24, 30, 77, 79, 102, 121 |
| operator-documentation | docs/deployment/database-migrations.md | 97, 99 |
| operator-documentation | docs/deployment/environment-variables.md | 38, 182 |
| operator-documentation | docs/operations/github-free-private.md | 48 |
| historical-design | docs/superpowers/plans/2026-08-30-mklms-production-audit-repair.md | 104 |
| historical-design | docs/superpowers/plans/2026-08-31-cloudflare-hyperdrive-r2-hardening.md | 9, 109, 111 |
| historical-design | docs/superpowers/plans/2026-08-31-protected-media-delivery-implementation-plan.md | 434 |
| historical-design | docs/superpowers/plans/2026-09-07-mkety-supabase-schema-wiring.md | 1, 5, 7, 9, 11, 16, 29 |
| historical-design | docs/superpowers/plans/2026-09-08-cloudflare-saas-installation-domains.md | 116 |
| historical-design | docs/superpowers/plans/2026-09-08-commercial-multi-production-release.md | 9 |
| historical-design | docs/superpowers/plans/2026-10-17-d1-first-migration.md | 5, 20, 29, 42, 43, 45, 72, 76, 77, 82, 85, 88, 90, 181 |
| historical-design | docs/superpowers/specs/2026-08-31-cloudflare-hyperdrive-r2-hardening-design.md | 9, 14 |
| historical-design | docs/superpowers/specs/2026-08-31-protected-media-delivery-design.md | 212 |
| historical-design | docs/superpowers/specs/2026-09-07-mkety-supabase-schema-wiring-design.md | 1, 4, 7, 15 |
| historical-design | docs/superpowers/specs/2026-09-08-commercial-multi-production-release-design.md | 106 |
| historical-design | docs/superpowers/specs/2026-10-17-d1-first-migration-design.md | 11, 60, 63 |
| other | scripts/audit-d1-compat.mjs | 2 |
| audit-tool | scripts/audit-d1-runtime-coverage.mjs | 21, 39, 49, 50, 71, 72, 84, 85, 87 |
| other | scripts/prepare-installation-proposal.mjs | 42 |
| active-runtime | src/app/api/admin/settings/platform/route.ts | 28 |
| active-runtime | src/features/settings/integration-status.ts | 37 |
| active-runtime | src/features/settings/platform-settings.ts | 15 |
| test-fixture | tests/commercial-installation-release.test.mjs | 26, 84 |
| test-fixture | tests/d1-runtime-coverage-audit.test.mjs | 5, 15, 17 |
| test-fixture | tests/mkety-release-wrapper.test.mjs | 17, 19, 21 |
| test-fixture | tests/mkety-supabase-wiring.test.mjs | 9, 10, 20, 21 |
