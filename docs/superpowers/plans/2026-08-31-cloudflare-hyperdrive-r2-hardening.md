# Cloudflare Hyperdrive and R2 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current MkLMS mainline production-safe for Cloudflare Workers, Hyperdrive, private R2 HLS delivery, immutable migrations, and beginner-operated local transcoding without breaking the working Vercel path.

**Architecture:** Keep the existing `DATABASE_URL` path for Node/Vercel and migrations, while Workers prefer a cache-disabled `HYPERDRIVE_FRESH` binding and optionally use `HYPERDRIVE_CACHED` only for explicitly safe public reads. Preserve opaque private HLS object paths and signed MkLMS delivery URLs, restore released migration 009, add forward-only cleanup migration 011, and document FFmpeg/rclone operation for a 2019 MacBook.

**Tech Stack:** Next.js 16, OpenNext for Cloudflare, Cloudflare Workers, Hyperdrive, PostgreSQL/Supabase, Cloudflare R2 S3 API, FFmpeg, rclone, Node 24 tests.

**Spec:** `docs/superpowers/specs/2026-08-31-cloudflare-hyperdrive-r2-hardening-design.md`

## Global Constraints

- Preserve all unrelated application features and the working Vercel/Node path.
- Keep `DATABASE_URL` usable for GitHub migrations and non-Worker deployments.
- Do not commit database, R2, signing, or account-specific Hyperdrive secrets/IDs.
- Security-sensitive and read-after-write database operations must remain fresh.
- Never expose the permanent R2 origin/object URL to course viewers.
- Released migrations are immutable; corrections happen in a new migration.

---

### Task 1: Lock migration and Cloudflare contracts with failing tests

**Files:**
- Create: `tests/cloudflare-hyperdrive-contract.test.mjs`
- Create: `tests/migration-immutability.test.mjs`

**Interfaces:**
- Consumes: current `wrangler.jsonc`, `src/lib/postgres.ts`, migrations 009/010.
- Produces: regression contracts that require fresh/cached binding support, a deploy-safe Wrangler template, released migration 009 content, and forward migration 011.

- [ ] **Step 1: Add a Hyperdrive contract test** that asserts `src/lib/postgres.ts` recognizes `HYPERDRIVE_FRESH`, `HYPERDRIVE_CACHED`, and legacy `HYPERDRIVE`, exports an explicit cached-query accessor, keeps `DATABASE_URL` fallback, and never requires a fake Hyperdrive ID in active Wrangler config.
- [ ] **Step 2: Add a migration immutability test** that asserts migration 009 contains the released `managed_hosting_settings` table, migration 010 remains `010_mklms_managed_hosting_months.sql`, and migration 011 drops the legacy table.
- [ ] **Step 3: Open a PR to `main`** so the repository's pull-request CI runs the tests and records the expected red state before production code changes.

### Task 2: Implement fresh and cached Worker database routes

**Files:**
- Modify: `src/lib/postgres.ts`
- Modify: `wrangler.jsonc`
- Modify: `src/app/(public)/live/[slug]/page.tsx`

**Interfaces:**
- Produces: `getPostgresPool()` as the fresh/default path and `getCachedPostgresPool()` as explicit opt-in public-read path.
- Cloudflare binding precedence for fresh path: `HYPERDRIVE_FRESH` -> legacy `HYPERDRIVE` -> `DATABASE_URL`.
- Cached path: `HYPERDRIVE_CACHED` when present; otherwise safely falls back to the fresh path.

- [ ] **Step 1: Implement binding selection** without keeping a live `pg.Pool` across Worker requests; each Worker query creates and closes a `pg.Client`.
- [ ] **Step 2: Keep Node/Vercel pooling unchanged** for the normal `DATABASE_URL` path.
- [ ] **Step 3: Route only stable public live-page platform settings through `getCachedPostgresPool()`** by injecting that pool into `PostgresSettingsRepository`.
- [ ] **Step 4: Keep live state/chat/playback APIs on the default fresh path.**
- [ ] **Step 5: Add a commented, deploy-safe Hyperdrive binding template to `wrangler.jsonc`** explaining that real IDs are inserted after Cloudflare creates them; do not put fake IDs in active config.

### Task 3: Restore migration history safely

**Files:**
- Modify: `db/migrations/009_mklms_media_ingest_hosting.sql`
- Keep unchanged: `db/migrations/010_mklms_managed_hosting_months.sql`
- Create: `db/migrations/011_remove_legacy_managed_hosting_settings.sql`

**Interfaces:**
- Produces: released migration 009 checksum-compatible structure plus forward-only cleanup after current migration 010.

- [ ] **Step 1: Restore migration 009** to the released version containing `managed_hosting_settings` and its seed row.
- [ ] **Step 2: Add migration 011** with `DROP TABLE IF EXISTS managed_hosting_settings` inside a transaction.
- [ ] **Step 3: Do not edit migration 010.**

### Task 4: Audit protected HLS delivery and prevent R2-origin leakage

**Files:**
- Inspect/modify if required: `src/providers/signed-delivery-media-provider.ts`
- Inspect/modify if required: `src/providers/s3-compatible-storage-provider.ts`
- Inspect/modify if required: `src/app/api/courses/[courseId]/lessons/[lessonId]/playback/route.ts`
- Inspect/modify if required: media delivery documentation/tests.

**Interfaces:**
- Produces: course playback responses containing only short-lived MkLMS delivery URLs; storage remains opaque/private.

- [ ] **Step 1: Add/extend a static security regression test** that rejects permanent `r2.cloudflarestorage.com` URLs in student playback surfaces and confirms signed delivery parameters/expiry remain required.
- [ ] **Step 2: Verify HLS child playlist/segment delivery model**; if documentation or implementation could allow unsigned child requests, tighten the contract without changing external public embeds such as YouTube.
- [ ] **Step 3: Preserve opaque media identifiers** such as `media/<asset-id>/master.m3u8` in database/admin workflows.

### Task 5: Write the beginner Mac FFmpeg + rclone + optional HandBrake runbook

**Files:**
- Modify: `docs/deployment/local-ffmpeg-to-r2.md`
- Modify if useful: `docs/deployment/transcoding-options.md`
- Verify: `scripts/transcode-hls.sh`
- Verify: `scripts/upload-hls-r2.sh`

**Interfaces:**
- Produces: a paste-ready workflow for the user's three current videos and future course batches.

- [ ] **Step 1: Document FFmpeg-only as the recommended route** for the 1-hour and two 45-minute videos, including Terminal navigation, filename quoting, output folders, the existing script, completion checks, and local playback verification.
- [ ] **Step 2: Document HandBrake as optional preprocessing only** for a corrupt/unusually difficult source; explain that normal HandBrake + FFmpeg double-encodes and is unnecessary.
- [ ] **Step 3: Document R2/rclone configuration** using an R2 Object Read & Write token, Cloudflare S3 endpoint, `region=auto`, bucket-scoped permission, upload command, restart-safe reruns, listing/verification, and the exact MkLMS master path.
- [ ] **Step 4: State clearly that the entire HLS directory must be copied**, not only `master.m3u8`.

### Task 6: Cloudflare and migration operator instructions

**Files:**
- Modify: `docs/deployment/cloudflare-hyperdrive.md`
- Modify: `docs/deployment/cloudflare-build-settings.md` if required.
- Verify: `.github/workflows/run-db-migrations.yml`

**Interfaces:**
- Produces: exact operator steps for Supabase Direct -> Hyperdrive configurations -> Worker bindings, while leaving the installation's existing `DATABASE_URL` secret intact.

- [ ] **Step 1: Document creation of `mklms-fresh`** using the Supabase Direct connection with query caching disabled.
- [ ] **Step 2: Document optional `mklms-public-cache`** using the same Direct connection with conservative caching for explicit safe public reads.
- [ ] **Step 3: Document insertion of returned configuration IDs into `wrangler.jsonc`** as `HYPERDRIVE_FRESH` and `HYPERDRIVE_CACHED`, or equivalent dashboard binding only if it will not be overwritten by source-controlled deployment config.
- [ ] **Step 4: Explain that setting an ordinary environment variable is not enough**; Hyperdrive is a Worker binding with a Cloudflare configuration ID.
- [ ] **Step 5: Verify migration workflow still consumes repository secret `DATABASE_URL`** and does not expose it.

### Task 7: Verification, PR cleanup, and merge

**Files:**
- No unrelated production files.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: green branch/PR and a clean open-PR state.

- [ ] **Step 1: Require PR CI success** for `npm test`, ESLint, Next.js production build, and OpenNext Cloudflare build.
- [ ] **Step 2: Re-check Cloudflare Workers build status** separately; a green OpenNext compile is not the same as a successful Cloudflare deployment.
- [ ] **Step 3: Audit PRs #14, #15, and #17 against the finished branch.** Close obsolete branches only after confirming every still-valid change is present. Never merge the outdated wallet/USDT path from #15.
- [ ] **Step 4: Merge the hardening PR only after the exact head is green.**
- [ ] **Step 5: Re-check main CI/Workers build after merge** and report any account-side Cloudflare setup still required, especially real Hyperdrive configuration IDs.
