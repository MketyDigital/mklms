# MkLMS production status — 2026-08-31

This file records the verified production-readiness state after the Cloudflare/Hyperdrive/R2 hardening work. It is intentionally explicit about what is proven and what still requires account-side verification.

## Source-control state

- Production branch: `main`.
- Cloudflare/Hyperdrive/R2 hardening was merged through PR #19.
- PR #14 was closed without merge; its valid migration-immutability intent was superseded by the hardening implementation.
- PR #15 was closed without merge; the obsolete USDT wallet/network configuration was intentionally excluded.
- PR #17 was closed without merge; its valid single managed-payment-URL behavior was already present/preserved in the hardening mainline.
- Draft PR #18 was closed without merge after the GitHub ready-for-review API failed; PR #19 used the exact same verified head.

## Verification completed before hardening merge

The verified hardening head passed:

- 152/152 domain, security, deployment and migration tests,
- ESLint,
- Next.js production build,
- Cloudflare OpenNext build,
- Wrangler deployment dry-run.

The Wrangler dry-run reported approximately 11,892.57 KiB total upload and 2,512.84 KiB gzip for the Worker package, below the 3 MiB compressed Workers Free script limit at the time of verification.

## Hyperdrive

MkLMS uses two explicit Cloudflare Hyperdrive bindings:

- `HYPERDRIVE_FRESH` -> configuration `bb7c9f70c2fe402080c22e06d0c0f305`
- `HYPERDRIVE_CACHED` -> configuration `14a4baf3773d41c88e4600967ab3b68d`

The fresh configuration is the default Worker database path for authentication, sessions, permissions, writes, admin operations, progress, billing, live viewer state, chat and playback authorization.

The cached configuration is opt-in and only used for stable public reads that can tolerate brief staleness. Its cache lifetime/stale-while-revalidate values are configured on the Hyperdrive configuration in Cloudflare, not in the Wrangler binding itself.

`DATABASE_URL` remains the Node/Vercel/migration/fallback database URL. Hyperdrive itself must connect to the PostgreSQL direct connection rather than an upstream session/transaction pooler.

## Database migrations

Repository migrations currently include 009, 010 and forward cleanup migration 011.

- Migration 009 is restored to the released historical contents for checksum safety.
- Migration 010 remains the managed-hosting-months migration.
- Migration 011 removes the legacy `managed_hosting_settings` table without rewriting released migration history.
- The migration runner/status commands now share one backward-compatible `_mklms_migrations` ledger implementation.

As of this status record, GitHub Actions shows no `workflow_dispatch` runs in the repository, so the protected `Run MkLMS DB migrations` workflow has not been executed through GitHub. Therefore this repository does not prove that migrations 009/010/011 have been applied to the selected production PostgreSQL database. Run a database status check against the intended database before applying pending migrations.

## Media and R2

- R2 stores completed HLS packages; it is not the transcoder.
- Recommended no-cloud-transcoding-fee path is local FFmpeg -> verify HLS -> rclone -> private R2.
- MkLMS stores opaque paths such as `media/<asset-id>/master.m3u8`, not public R2 origin URLs.
- Student playback authorization is short-lived and signed.
- End-to-end private HLS delivery additionally requires the separate delivery surface behind `MKLMS_MEDIA_DELIVERY_BASE_URL` to validate authorization for master playlists, child playlists and media segments.

## Remaining operator checks

1. Verify the Cloudflare deployment of the current `main` commit finishes successfully with both Hyperdrive bindings.
2. Run migration status against the intended production PostgreSQL database before applying any pending migration.
3. Apply only genuinely pending migrations in numeric order.
4. Verify a real Worker database request uses Hyperdrive successfully.
5. Transcode and upload one short test HLS asset to R2 and verify end-to-end protected playback before bulk media upload.
