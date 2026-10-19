# MkLMS D1-First Dual-Backend Migration Design

**Status:** Approved direction; implementation plan under review  
**Date:** 2026-10-17  
**Scope:** Mainline engineering and staging proof. This design does not itself authorize a production database switch.

## Goals and end state

Deliver a complete D1 application path. After a separately approved, proven production cutover, D1 is the sole active write authority and PostgreSQL is a synchronized standby that can safely resume authority through a rehearsed reverse switch. Exactly one backend accepts application writes for an installation at any time.

Remove Supabase-specific application dependencies from the final MkLMS system: SDKs, Supabase Auth/Storage/REST integrations, generated client types, and provider-specific runtime or deployment code. Keep PostgreSQL portable through the generic `pg`/Hyperdrive adapter, so any PostgreSQL host—including a Supabase-hosted PostgreSQL instance—can be selected as a manually activated standby. Mkety Academy must leave the currently connected `mkety_academy` schema as its runtime database; any Supabase PostgreSQL standby must use a separately scoped schema/role and be brought current through tested replication before activation. A separate schema in the same Supabase project is logical isolation, not an independent provider backup or outage domain.

Preserve the current production state and release model during engineering: Starpips and Mkety Academy retain independent production/<installation> pointers and remain on PostgreSQL until separate cutover gates pass. No production pointer, production database, Hyperdrive binding, secret, R2 object, protected-media Worker, or live-class behavior changes as part of ordinary implementation.

## Current constraints

- main is the shared development branch; production is promoted separately for each installation.
- PostgreSQL migrations 001–020 define the source schema. D1 currently has migrations 0001–0015 and is not wired into runtime query handling.
- Existing D1 stores and offline schema tests are foundations, not a complete application backend.
- database-backend-policy.ts, database-cutover-contract.ts, and DUAL_BACKEND_CUTOVER_CONTRACT.md are not a distributed authority gate or replication implementation.
- Do not modify historical PostgreSQL migrations or mix customer-specific behavior into domain logic.
- Preserve all already merged D1 foundations and approved/open work, including the schema changes in PR #148.

## Proposed architecture

### Database adapters and application services

Keep existing domain/service contracts and PostgreSQL repositories intact. Add D1 implementations behind the same repository interfaces, selected by validated installation-scoped configuration. Default and unknown/missing configuration must continue to select PostgreSQL or fail closed; D1 must not be selected unless its binding and schema are verified and an explicit staged authority record permits it.

D1 SQL uses SQLite syntax and bound parameters. Multi-row invariants use D1-supported atomic batches/constraints, with concurrency tests; do not emulate PostgreSQL transactions using multiple independent calls. No silent fallback between databases on errors.

Cover every runtime persistence path: access and enrollment, courses and progress, certificates, quizzes, live sessions/chat, media entitlements/playback progress, messages, settings, notifications, managed hosting, and payment/ledger settlement. Preserve external payment and media boundaries and the server-owned live playback clock.

### Schema and data semantics

Treat PostgreSQL migrations 001–020 as the authoritative final model. Extend D1 migration history additively; never rewrite applied migrations once used outside disposable tests. Verify final schemas by executing both histories in isolated test databases and comparing tables, columns, indexes, uniqueness/partial indexes, checks, foreign keys, triggers, defaults, and relevant SQLite/PostgreSQL type behavior.

Define reversible conversions for money (integer cents with exact sign semantics), timestamps/time zones/precision, booleans, JSON, generated identifiers and PostgreSQL-specific values. Data copy must preserve primary keys and relationships. Migration and parity gates must expose unsupported constructs rather than declare success from text parsing alone.

### Durable synchronization

Build an installation-scoped, versioned mutation journal with ordered sequence numbers, idempotency keys, tombstones, bounded retry/backoff, retention and dead-letter visibility. Initial copy uses a consistent snapshot plus watermark; subsequent replay advances from that watermark. Implement adapters in both directions and record acknowledgements only after durable target apply. Payments, access revocations, enrollment, live state/chat and progress are critical entities.

PostgreSQL and D1 are never independent active writers. While one is authoritative, the other receives standby replay only. Replication failures increase observable lag and block cutover; they never trigger database failover automatically.

### Authority and switching

Create a strongly consistent authority record per installation with backend, monotonically increasing epoch and phase. All write paths—HTTP requests, cron/scheduled jobs, webhooks and admin actions—must validate the current backend/epoch at a shared write gate. Old-epoch and standby writes are rejected. KV or deployment variables alone are not considered an atomic gate.

Switch procedure: fence new source writes; drain in-flight writes and schedulers; replay through the final acknowledged watermark; reconcile target schema, critical rows and checksums; verify target readiness and rollback path; atomically advance epoch and backend; then resume writes. Fail closed on missing proof. Reverse switching requires the same steps and a caught-up PostgreSQL standby.

### Monitoring, recovery, and isolation

Expose per-installation schema version, authority backend/epoch, source and target watermarks, replication lag, last reconciliation, dead letters, and health. Alert on stale replay or failed integrity checks. Keep encrypted restorable backups distinct from the live standby and rehearse full restores.

Provision D1 databases and bindings separately per installation. Keep secrets out of manifests. Do not reuse customer data, bindings, or authority records across Starpips and Mkety Academy.

## Delivery gates

1. **Full-repository baseline:** inventory runtime, routes, jobs, manifests, workflows, dependencies, environment variables, generated files, tests and all Supabase references; record existing app behavior and migrations.
2. **Schema gate:** full executable parity and tested reversible data mappings.
3. **Runtime gate:** every application flow runs against both backends with meaningful integration and end-to-end tests; PostgreSQL production behavior remains unchanged.
4. **Provider portability gate:** no Supabase SDK/Auth/Storage/REST dependency in runtime, build, or release configuration; generic PostgreSQL remains supported for a separately scoped Supabase-hosted standby. The CI audit rejects Supabase-specific runtime dependencies while narrowly allowing read-only migration-source and standby documentation references.
5. **Replication gate:** snapshot, replay, idempotency, ordering, deletes, retries, interruption recovery and integrity checks pass both directions.
6. **Fencing gate:** concurrency/crash tests prove a single writer and rejection of stale epochs across all write entry points.
7. **Staging gate:** each installation has masked/synthetic restore, load/failure-injection tests, complete per-table reconciliation and rehearsals in both directions with no lost acknowledged writes, duplicate charges, or stale access.
8. **Production decision gate:** separate explicit operator approval for each installation after fresh backups, class-free window, exact watermark, rollback thresholds, monitoring and human escalation are confirmed. No development workflow automatically promotes a production pointer or changes a live database.

## Non-goals

- No production cutover in the implementation branch.
- No dual-active writes or timeout-triggered failover.
- No changes to R2 media, standalone media delivery, payment provider integrations, broadcast playback semantics, domains, secrets, or customer release pointers except after separately reviewed production authorization.
- No claim of near-zero downtime until measured staging rehearsals establish actual interruption and recovery bounds.
