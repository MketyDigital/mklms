# Dual backend day-one contract and near-zero-downtime cutover

**Meaning of day one:** MkLMS must ship with working, separately tested D1 and PostgreSQL drivers before enabling D1 for a production installation. After verification, either driver may be selected by installation; only the selected database is authoritative. This does **not** mean zero-lag or zero-downtime switching is automatically possible. A fully synchronized standby, write fencing, and recovery replay are mandatory for fast switching.

## State machine and writer fencing

- `SERVING`: exactly one writer backend with a monotonic installation-scoped epoch; the other database is a standby and must reject application writes. Read-only consistency checks against standby are allowed.
- `FENCING`: reject *new* writes at a centralized, atomic authority gate, drain outstanding writes, halt/coordinate schedulers, webhooks and jobs; media streaming can continue.
- `REPLAYING`: ingest all durable source changes up to a known checkpoint into target; include deletes, payments, auth, live chat and progress.
- `VERIFYING`: confirm zero unapplied committed changes, table/hash/FK matches, migrations, backend readiness, restore plan, authorization and live/session state.
- Commit a new epoch and switch the selected backend **atomically** in a strongly consistent control plane, then return to `SERVING`. All old-epoch requests must fail before writing.
- The pure helper `src/lib/database-cutover-contract.ts` validates proofs and epochs, but **is not** an implemented distributed lease, replication system, or runtime switch. It must not be wired into production as a safety guarantee without a real atomic gate.

## Proposed operational configuration

Each installation carries `databaseBackend: "d1" | "postgresql"`, a D1 binding ID and an isolated PostgreSQL Hyperdrive binding. Keep credentials secret and installation-scoped, and reject unknown backend values. In existing production installations, `postgresql` remains selected until D1 parity and migration gates pass. Never auto-switch on a DB timeout: a network partition might make two authorities believe they are primary. No silent dual-write or silent read fallback.

## Backup vs standby

- **Backup** = restorable, encrypted snapshots with retention, tested recovery point/time.
- **Warm standby** = synchronized PostgreSQL database that can assume authority at a verified checkpoint and epoch. Near-zero interruption depends on continuous, observable D1-to-PostgreSQL change capture, not simply having a Hyperdrive connection. SQLite/D1 does not automatically replicate into PostgreSQL or vice versa.
- If latest writes cannot be reproduced on the target, do not promote it. Stop writes and reconcile instead of losing enrollments, chats or payments.
- Keep `mksaas` public/app PostgreSQL private behind `MKETY_DB` Hyperdrive, Workers VPC, Tunnel and Coolify. Provision a **separate** MkLMS database/user/binding; never reuse SaaS credentials, tenants or workload without tested isolation and performance.

## Switching back

PostgreSQL-to-D1 requires a new checkpoint, reverse replay, fencing, integrity verification, and an incremented authority epoch. No direct toggle while writes are in flight. Reserve a class-free maintenance window for the first switch in each direction; shorten only after verified drills and metrics.

## Remaining critical implementation before live use

1. Convert all PostgreSQL migrations and queries to an equivalent D1 schema and adapter; separately validate PostgreSQL unchanged.
2. Per-installation D1 provisioning in a **nonproduction** environment and contract tests against both databases.
3. Bidirectional, versioned CDC/outbox or change capture with reliable tombstones, idempotency keys and ordered replay; prove no gaps.
4. Atomic strongly consistent routing/fencing mechanism shared by all Workers, cron jobs, payment handlers and admin writes. Do not assume KV or deployment variables offer instantaneous coordinated switching.
5. Backup and full restore drill, failure injection during sessions, replay lag dashboards, and explicit operator runbook.
6. Exact-SHA release, no unrelated changes, independent Starpips and Mkety Academy cutovers.

The present PR is an offline, nonproduction contract increment only.
