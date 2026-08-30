# MkLMS Cloudflare Free Production Setup

MkLMS is prepared to run on Cloudflare Workers Free using OpenNext. Cloudflare is the intended production edge/runtime; Vercel is a compatibility/test deployment only.

## Runtime

- Node.js development/CI/Vercel/OCI target: Node 24.x.
- Cloudflare production runtime: `workerd` with Node compatibility enabled.
- Build: `npm run cf:build`
- Preview: `npm run preview`
- Deploy: `npm run deploy`

## Required secrets / variables

Store secrets in Cloudflare Workers settings, never in git. At minimum configure the same server variables used by the Node deployment, including `DATABASE_URL`, admin/session secrets, media signing configuration, storage credentials, SMTP credentials and optional Telegram credentials when those providers are enabled.

## PostgreSQL: test now, self-host later

MkLMS uses PostgreSQL as a database engine, not Supabase-specific APIs. `DATABASE_URL` may therefore point to Supabase PostgreSQL for testing and later to self-hosted PostgreSQL.

Cloudflare Hyperdrive is optional and available on Workers Free. When enabled, create a Hyperdrive configuration pointing at the same PostgreSQL database and provide its connection string to the application's PostgreSQL client. Authentication/session/permission reads should use a cache-disabled Hyperdrive configuration; safe shared reads may use query caching.

## High-audience webinar state cache

For `CONFIGURED_BASELINE` live classes, `/api/live/*/state` is now a shared response: it contains no viewer identity and no attendee-private messages. The response sends a 5-second CDN cache policy with 30-second stale-while-revalidate.

Create one Cloudflare **Cache Rule** on the Free plan:

- Match: URI Path starts with `/api/live/` AND URI Path ends with `/state`
- Cache eligibility: Eligible for cache / Cache Everything
- Respect origin/CDN cache-control headers
- Do not include cookies in a custom cache key

Do **not** cache login, claim, playback-authorization, admin, student-session or message POST endpoints.

Measured viewer modes (`ACTIVE_ONLY`, `BASELINE_PLUS_ACTIVE`) remain uncached because they intentionally update/read presence. Use `CONFIGURED_BASELINE` for high-audience broadcasts.

## Private attendee comments

A submitted attendee comment is still persisted once in PostgreSQL so the admin inbox remains authoritative and optional Telegram notification still works. The attendee-facing copy is then stored in that browser's `localStorage` (maximum 50 recent comments). Shared live-state polling no longer reads that attendee's comments from PostgreSQL.

## Video

Do not stream video bytes through the Worker. Course/webinar media should be HLS/static media on object storage + CDN. A production transcode pipeline should process each uploaded source once, write immutable HLS renditions/segments to durable storage (R2 is the preferred delivery store), mark the media asset READY, and reuse those stored outputs for every future viewer. Re-transcode only when the source or encoding profile changes.
