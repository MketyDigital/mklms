# MkLMS D1-first migration and live release plan (2026-10-16)

Status: **design and read-only audit only**. No production database cutover, no schema mutation, no secrets rotation, no Worker deployment.

## Sequencing and live safety

1. Live broadcast clock fix: PR #121 passed CI and was merged to `main` at `93309a423199ad224ce09d6ad4853c329b8020f8`. **Not promoted to production**. Finish real-room tests (late entry, 2–30 minute outage, resume, foreground, scheduled close, staged/shared chat, 400 MB+ MP4 byte-range playback) and deploy as a standalone release in a class-free window, separately per installation. Never combine with D1 changes.
2. Preserve production PostgreSQL + Hyperdrive as the only authoritative backend while auditing compatibility.
3. Introduce and test D1 access behind an explicitly disabled, installation-scoped backend switch. No silent fallback from failed D1 writes to another database.
4. Migrate installations individually after full replay validation. Retain self-hosted PostgreSQL as an **independent, recovery-capable backup** only after a continuous, verified replication/recovery process exists.

## Current repository evidence

- `src/lib/postgres.ts` uses `pg` and Cloudflare `HYPERDRIVE_FRESH`/`HYPERDRIVE_CACHED`, falling back to `DATABASE_URL` outside Workers.
- `scripts/migrate.mjs` and 20 migrations in `db/migrations` execute PostgreSQL SQL and track checksums in `_mklms_migrations`.
- `wrangler.jsonc` binds two Hyperdrive connections and R2, not D1.
- Mkety Academy's previous provider endpoint has been removed from source configuration. Its approved self-hosted PostgreSQL target and existing data/schema still require independent verification before migration or cutover. Starpips uses its separately isolated PostgreSQL via Hyperdrive.
- `MketyDigital/mksaas` has a Drizzle/PostgreSQL implementation (`src/shared/db/index.ts`), documentation for PostgreSQL 15+ with pgvector (`docs/DATABASE.md`), and Worker Hyperdrive integration. **Its documentation also mentions AWS RDS in cloud environments**; do not assume the active self-hosted instance, routing, credentials, tenant schemas, security boundaries, or available capacity until independently verified. Never reuse mksaas's application tables as MkLMS tables.
- Neither PostgreSQL nor D1 is a media store; both existing R2 buckets, protected delivery Worker, and signed media URLs remain unchanged.

## Design decisions

**Per-installation selection**: `postgresql` is the current default; `d1` requires a deliberate installed binding and a verified, signed release/configuration change. Retain a PostgreSQL implementation compatible with the original MkLMS schema. D1 is SQLite, not PostgreSQL; translating SQL is mandatory.

**Isolation**: distinct D1 database per installation (`starpips`, `mkety-academy`). If using the Mkety self-hosted PostgreSQL for backup, provision a dedicated MkLMS database or isolated schemas/users per installation with least privilege and physically separate retention/backups; do not connect an LMS directly to SaaS tenant tables. Confirm backup capacity, SLA, patching, pgvector, networking, Hyperdrive connection bindings, and recovery procedures first.

**Data fidelity**: preserve primary IDs, foreign keys, tenant separation, timestamps/time zones, auth/session hashes, enrollment/course progress, session schedules, staged/shared chat, messaging, upload metadata, certificate verification, idempotency keys, billing audit ledger, and nullable/JSON semantics. Never overwrite a populated D1 target from an outdated snapshot.

**Concurrency**: test D1's SQLite transaction and write model against duplicate enrollments/payment callbacks, concurrent chat, viewer counts, certificate issuance, and scheduled transitions. Cross-backend shadow reads must never authorize user actions. Live state needs read-after-write consistency; use D1 Sessions/bookmarks if using replicas.

**Replication and rollback**: do not assume pgvector/PostgreSQL replication automatically synchronizes with D1. Build a durable ordered CDC/outbox mechanism with idempotent event IDs and replay offsets, including deletes/schema-version mapping. PostgreSQL backup cannot serve as a reliable rollback once D1 receives new writes without a tested reverse replay or export/re-import; designate a recovery point and test restoration. No uncontrolled dual-write.

## Gates (in this order)

1. **Inventory**: classify every direct `getPostgresPool()`, `.query()`, `.connect()`, SQL migration, job, external dependency, and tenant boundary; enumerate DDL and SQL dialect incompatibilities. Use `node scripts/audit-d1-compat.mjs` for a static initial inventory, not as proof of portability.
2. **Transform**: write reviewed SQLite schema migrations in a separate D1 directory, with checksums and startup guards. Map `TIMESTAMPTZ`, UUID, JSONB, arrays, booleans, `RETURNING`, `ON CONFLICT`, partial indexes, `FOR UPDATE`, `ILIKE`, sequence behavior and PostgreSQL casts. Validate referential integrity and Unicode/timezones.
3. **Adapter**: backend interface for both implementations with SQL/transaction operations tested on local disposable PostgreSQL and D1; never feed `$1` SQL to D1 blindly.
4. **Initial copy**: consistent read-only PostgreSQL snapshot per installation, encrypted backup and export, row counts and checksums, resumable bulk import to *nonproduction* D1. Preserve media keys in R2; do not copy media blobs to D1.
5. **Continuous sync**: durable change-log/CDC from authoritative PostgreSQL; record source LSN/sequence and D1 replay checkpoint, reconcile changes and tombstones; monitor lag and integrity.
6. **Shadow**: compare read-only results for a representative workload. Specifically verify live state transitions, chat ordering, student permissions, course access, certificates, and financial records without shadow-side writes.
7. **Load tests**: burst chat, playback auth, login, progress and payment webhook concurrency, D1 row/DB size limits and query/CPU/latency budgets; observe steady peak class load and failure recovery.
8. **Cutover**: during a scheduled class-free window, backup, write-fence mutable app routes, drain in-flight jobs, replay through final PostgreSQL checkpoint, validate counts/hashes and identity/certificate/payment invariants, atomically select D1 for *one* installation, resume and smoke test. Keep a clear abort path before writes unfreeze.
9. **Rollback/retention**: retain verified PostgreSQL source and separately backed-up self-hosted target; if D1 already accepted writes, apply tested reverse replay before rollback. Remove retired provider credentials only after the retention/verification window and source-of-truth audit close.

## Non-negotiable release criteria

- Both old and new backends pass contract/integration tests; replay is repeatable with no missing/duplicate writes.
- 100% critical records and foreign keys reconcile, including payment/certificate/history invariants. Staged and shared chat timestamps remain ordered.
- Live player and session scheduler behavior identical; zero regressions to course videos and media authorization.
- Explicit deployment approvals, observability, backup restore drill and tested rollback, health check and error budget.
- No production D1 binding or traffic switch from this initial architecture PR.

## Next implementation increments

A. Static SQL/access inventory and per-query conversion plan (this PR).
B. Read-only database adapter contract + SQLite mappings/tests in a separate PR.
C. Local disposable D1 schema and equivalence tests.
D. Snapshot/CDC/reconciliation tools and backup verification.
E. One-installation canary and subsequent approved production cutover.

The self-hosted PostgreSQL target is a **candidate**, not a confirmed operational backup. Obtain a restore-tested tenant-isolated target before relying on it.
