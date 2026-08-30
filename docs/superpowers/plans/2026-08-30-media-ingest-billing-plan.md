# MkLMS Safe Media Ingest + Managed Hosting Plan

## Goal

Make Cloudflare Workers/OpenNext the default production runtime while keeping OCI/Node portable; add a safe one-time OCI Media Flow -> R2 media workflow with a manual fallback; add transparent admin usage/managed-hosting billing without fake metrics.

## Locked boundaries

- Live Classes are standalone from paid Courses. Both share the MkLMS identity/settings/media/messaging/platform layers, but a live batch does not require a course or enrollment.
- Cloudflare Workers/OpenNext is the primary production runtime. Large media bytes never proxy through the Worker.
- PostgreSQL migrations are deployment-independent release operations against `DATABASE_URL`; they are not Vercel/Cloudflare/OCI build steps.
- OCI Media Flow runs once per source + encoding profile. Finished HLS is copied to Cloudflare R2 and future playback comes from R2/CDN.
- Paid OCI automation is never triggered by an accidental UI click. Estimate and explicit confirmation precede any paid transcode integration.
- Manual OCI Console/CLI -> R2 transfer remains a supported first-class fallback.
- Usage shown as measured only when MkLMS has server-side evidence. Baseline live-class audience usage is labelled estimated, never represented as measured.
- Managed hosting fee is a service charge, distinct from infrastructure cost. Default configurable range: USD/USDT 15-50/month.

## Phase A — migration/deployment operations

1. Document exactly where/when/how to run `npm run db:migrate` for local, Vercel, Cloudflare and OCI deployments.
2. Keep migrations out of normal app build commands.
3. Add release checklist: backup/snapshot, set production `DATABASE_URL`, run migration once, verify `/admin/settings` database health, deploy app.
4. Keep `_mklms_migrations` checksum history authoritative.

## Phase B — media ingest safety domain

1. Add OCI Media Flow cost estimator for Standard H264 output rungs.
2. Add ingest lifecycle: DRAFT -> SOURCE_UPLOADED -> TRANSCODING -> TRANSCODED -> COPYING_TO_R2 -> VERIFYING -> READY, with FAILED terminal/retry state.
3. Store source object, OCI job ID, output prefix, R2 prefix/master manifest, expected/actual duration and estimated transcode cost.
4. Require explicit `costAcceptedAt` before any automatic paid job may be marked eligible.
5. No automatic provider call is enabled unless `MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=true` and required integration settings exist.

## Phase C — manual-safe workflow

Admin Media screen gets a guided manual path:
1. Upload source directly to private OCI Object Storage.
2. Run the configured Media Flow workflow once.
3. Verify the OCI job is `Succeeded` and output contains an HLS master manifest + segments.
4. Copy only the completed output prefix to R2 using S3-compatible tooling/rclone.
5. Verify R2 `master.m3u8` and segments exist.
6. Register/mark the MkLMS media asset READY with the R2 provider path.

The source and temporary OCI output may be deleted after R2 verification according to owner policy.

## Phase D — automated OCI -> R2 workflow

Preferred infrastructure-side automation (not large-file Worker processing):
- Direct browser upload to OCI Object Storage through a time-limited write-only/prefix PAR or another provider upload adapter.
- OCI Object Create event -> Oracle pre-built Media Workflow Job Spawner -> one Media Flow job.
- Media Flow job completed event -> dedicated OCI-side R2 publisher function/job.
- Publisher copies generated HLS output objects to R2 via the S3-compatible endpoint, verifies master + segment objects, then calls an authenticated MkLMS completion webhook or writes status through a narrowly scoped adapter.

Automation remains disabled until a tiny sample is successfully smoke-tested in the target OCI region/tenancy.

## Phase E — usage and managed-hosting billing

1. Add usage summary domain with `MEASURED` vs `ESTIMATED` labels.
2. Course video watch time uses trusted server-side video progress/grant evidence.
3. Live baseline audience-minutes are estimates: configured baseline x active session minutes; never call this real viewer telemetry.
4. Add managed-hosting settings: enabled, min/max monthly fee, current fee, USDT network (TRC20/TON/custom), wallet address, payment note.
5. Admin dashboard/settings show infrastructure estimate separately from managed service fee.
6. Never fabricate provider invoices or claim estimated usage is measured.

## Verification gate

Before merge:
- cost/state/billing domain tests green;
- existing suite green;
- lint green;
- Next.js Node 24 production build green;
- Cloudflare OpenNext production build green;
- no paid OCI API call occurs in CI/tests;
- automation defaults OFF.
