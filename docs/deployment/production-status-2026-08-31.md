# MkLMS production status — 2026-08-31

This file records verified production-readiness work and explicitly separates repository-proven behavior from account-side deployment checks that still require operator confirmation.

## Source-control state

- Production branch: `main`.
- Cloudflare/Hyperdrive/R2 hardening was merged through PR #19.
- Production Hyperdrive bindings were merged through PR #20.
- PR #14, #15, #17 and draft #18 were closed without merging their stale/obsolete branches.
- Protected direct-media delivery is being implemented and verified on PR #21 before any merge to `main`.

## Previously verified hardening

The hardening head passed 152/152 tests, ESLint, Next.js production build, Cloudflare OpenNext build and main Wrangler dry-run. The main Worker package was approximately 2,512.84 KiB gzip at that verification point.

## Hyperdrive

MkLMS currently declares:

- `HYPERDRIVE_FRESH` -> `bb7c9f70c2fe402080c22e06d0c0f305`
- `HYPERDRIVE_CACHED` -> `14a4baf3773d41c88e4600967ab3b68d`

Fresh is the default consistency-sensitive Worker database path. Cached is explicit opt-in for stable public reads that tolerate brief staleness. `DATABASE_URL` remains the Node/Vercel/OCI/migration/fallback database URL.

## Database migrations

Repository migrations include 009, 010 and forward cleanup migration 011. Released migration history is preserved and migration status/migrate commands share the backward-compatible canonical ledger.

**Production database application status is still not proven by this repository record.** The operator must run/inspect the protected GitHub migration workflow against the intended database before the deployment is considered schema-current. This is especially relevant to `/admin/media`, because migration 009 creates the media-ingest tables used by that page.

## Protected direct MP4 delivery

PR #21 adds a standalone Cloudflare Worker at `workers/media-delivery/` for private R2 media.

Verified behavior on the latest functional head before this status-only documentation update:

- 166/166 repository tests passed;
- ESLint passed;
- normal Next.js production build passed;
- Cloudflare OpenNext build passed;
- main MkLMS Worker Wrangler dry-run passed;
- standalone protected media Worker Wrangler dry-run passed.

The media Worker:

- uses a private `MEDIA_BUCKET` R2 binding;
- requires the existing short-lived HMAC authorization before any R2 read;
- supports direct H.264/AAC MP4 full GET, HEAD and HTTP byte ranges;
- returns `206 Partial Content` for valid ranges and `416` for invalid ranges;
- does not expose permanent R2 S3/object URLs;
- uses private/no-store response caching semantics;
- keeps optional CORS origin filtering separate from mandatory signature verification.

Direct MP4 is now the recommended initial path for the current Zoom recordings. HLS support remains in the application for future adaptive streaming.

## Paid-course playback

Paid-course authorization remains owned by MkLMS and still requires the authenticated student/session, active/completed enrollment, published course/lesson, prerequisite access and READY media before a signed playback URL is issued. Private playback TTL remains capped by the remaining student session lifetime.

## Free live-class playback

The public live-class link remains free to open without student enrollment. Media authorization is issued only while the server-authoritative schedule resolves the current session to `LIVE`.

Additional hardening in PR #21 caps the live media authorization TTL to the remaining scheduled session time. Therefore an authorization created near the end of the class cannot retain the normal live TTL beyond the scheduled session end. The existing current-offset/late-join behavior and authorization refresh flow remain intact.

## Authentication

No external authentication vendor is required for the current launch architecture.

- Admin uses the built-in access-key login plus signed HTTP-only production session cookie.
- Students use built-in preauthorization, hashed access credentials, server sessions and enrollment/access checks.
- Optional student runtime fallbacks are documented in `docs/deployment/environment-variables.md`.

The built-in system does not currently provide MFA, SSO/Google login, password-reset email workflow, or multiple named administrator identities. Those are optional future upgrades rather than launch dependencies.

## Environment and host portability

`docs/deployment/environment-variables.md` is the authoritative configuration reference. It distinguishes:

- portable application environment variables;
- Cloudflare-only Hyperdrive/ASSETS bindings;
- the media Worker's `MEDIA_BUCKET` binding;
- Vercel configuration;
- OCI/VPS/Docker/normal Node configuration;
- self-hosted PostgreSQL;
- operator-only R2/rclone credentials;
- optional SMTP, Telegram, OCI media automation and managed-hosting settings.

## Remaining account-side/operator checks

1. Run and verify production database migration status/apply/status against the intended PostgreSQL database.
2. Create/confirm the private R2 bucket named `mklms-media`, or change only the media Worker's configured `bucket_name` to the actual private bucket.
3. Set one strong `MKLMS_MEDIA_SIGNING_SECRET` on both the main MkLMS app and the media-delivery Worker.
4. Deploy the standalone media-delivery Worker and capture its `workers.dev` or custom-domain URL.
5. Set that URL as `MKLMS_MEDIA_DELIVERY_BASE_URL` on the main application and redeploy it.
6. Verify the actual Cloudflare main application build/deploy succeeds with production dashboard settings and Hyperdrive bindings.
7. Upload one original H.264/AAC MP4 to private R2 using rclone and register only its opaque object key as a `DIRECT` media asset.
8. Test paid playback, seeking, resume and authorization refresh against the real object.
9. Test the free live room before LIVE, during LIVE with current-offset seeking, and after session end.
10. Only after those end-to-end checks, upload the remaining production videos.
