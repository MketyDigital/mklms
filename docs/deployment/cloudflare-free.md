# MkLMS Cloudflare Free Production Setup

Cloudflare Workers/OpenNext is the primary production runtime for MkLMS. Vercel is a compatibility/test target and OCI/Node remains portable for later or separate customer installations.

The existing OpenNext deployment is intentionally retained for the current launch because it is already verified by CI. Cloudflare's newer Next.js guidance may evolve, but runtime migration should be treated as a separate tested project rather than changing the production adapter immediately before a live class.

## Runtime

- Development/CI/Vercel/OCI Node target: Node 24.x.
- Cloudflare production runtime: `workerd` with `nodejs_compat`.
- Local/OpenNext build: `npm run cf:build`
- Local preview: `npm run preview`
- One-command CLI deployment: `npm run deploy`

## Cloudflare dashboard build/deploy settings

When Cloudflare provides separate **Build command** and **Deploy command** fields, use exactly:

```text
Build command: npm run cf:build
Deploy command: npx opennextjs-cloudflare deploy
```

The Build command must create `.open-next` before the deploy command executes.

**Do not use `npm run build` as the Cloudflare build command.** That creates the normal Next.js `.next` output for Node/Vercel, not the OpenNext Worker bundle.

If only one combined deployment command is available, use:

```text
npm run deploy
```

The repository CI contract verifies Node 24 tests, lint, the ordinary Next.js build and the OpenNext build.

## Required Cloudflare secrets / variables

Store secrets in Worker settings, never in git. Minimum runtime configuration:

- `DATABASE_URL`
- `DATABASE_SSL=require` when required by the PostgreSQL provider
- `DATABASE_POOL_MAX=5` initially
- `MKLMS_ADMIN_ACCESS_KEY`
- `MKLMS_ADMIN_SESSION_SECRET`

Optional integrations:

- Telegram: `MKLMS_TELEGRAM_BOT_TOKEN`, `MKLMS_TELEGRAM_CHAT_ID`
- R2/S3-compatible storage: `MKLMS_STORAGE_*`
- protected media authorization: `MKLMS_MEDIA_DELIVERY_BASE_URL`, `MKLMS_MEDIA_SIGNING_SECRET`
- SMTP: `MKLMS_EMAIL_PROVIDER=smtp`, `MKLMS_SMTP_*`, `MKLMS_EMAIL_FROM`
- OCI media automation: `MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false` by default plus the OCI/R2 variables documented in the media-ingest runbook.

## Database migrations — release before deployment

Migrations modify PostgreSQL, not Cloudflare. Never put them in the Cloudflare Build or Deploy command.

From a trusted Node 24 shell with the production direct PostgreSQL connection:

```bash
export DATABASE_URL='postgresql://...'
export DATABASE_SSL=require
npm install
npm run db:status
npm run db:migrate
npm run db:status
```

Then deploy/redeploy the Worker.

The `_mklms_migrations` table stores migration filenames, SHA-256 checksums and application timestamps. An already-applied migration must never be edited; create the next numbered SQL file instead. See `docs/deployment/database-migrations.md`.

If Cloudflare Hyperdrive is later enabled, it remains runtime connection management. Use a trusted direct PostgreSQL connection for migrations unless a deliberately controlled migration mechanism is introduced.

## Free-plan capacity boundaries

Cloudflare Workers Free currently has finite daily Worker requests/CPU. Therefore **video HLS manifests/segments must not be proxied through the MkLMS application Worker**. Large media belongs on R2/CDN or another media origin. MkLMS should issue/control playback authorization without turning every segment into an application request.

R2 Standard includes a monthly free allowance before storage/operation charges. Egress from R2 to the Internet is free. Treat provider pricing as external and changing; Admin → Hosting & Usage shows MkLMS usage signals/estimates, not a fabricated Cloudflare invoice.

## Recommended media topology

```text
Admin source video
      ↓
private OCI Object Storage
      ↓
OCI Media Flow — ONE transcode per source/profile
      ↓
verify completed HLS output
      ↓
copy immutable HLS folder to Cloudflare R2
      ↓
R2 / Cloudflare CDN playback
      ↓
MkLMS course OR live-class media asset
```

The Cloudflare Worker does not upload/proxy gigabyte video bodies and does not perform transcoding.

## High-audience webinar state cache

For `CONFIGURED_BASELINE` live classes, `/api/live/*/state` is viewer-neutral: no viewer identity and no attendee-private comments. The response is eligible for a short edge cache while browsers advance deterministic LIVE/chat/CTA timing locally.

Create one Cloudflare Cache Rule:

- Match: URI Path starts with `/api/live/` AND ends with `/state`
- Cache eligibility: Eligible / Cache Everything
- Respect origin/CDN cache-control headers
- Do not make cookies part of a custom cache key

Never cache login, claim, playback authorization, admin/session or message mutation endpoints.

Use `CONFIGURED_BASELINE` for high-audience broadcasts. `ACTIVE_ONLY` and `BASELINE_PLUS_ACTIVE` intentionally perform presence work and remain uncached.

## Private attendee comments

A submitted attendee comment is written once to PostgreSQL for the authoritative admin inbox and optional notification. The viewer-facing copy is held in bounded browser local storage. Shared live state does not continually reload private comment history.

## Multiple installations

Cloudflare and OCI can host separate MkLMS installations at the same time. For independent customers, give each installation its own database, environment/secrets, domain and storage configuration.

Two runtimes may intentionally share one database, but then they are one logical installation and must remain on compatible code/schema versions.

## Telegram quick setup

1. Create a bot with Telegram `@BotFather` and copy the token to `MKLMS_TELEGRAM_BOT_TOKEN`.
2. Add the bot to the destination group/channel and grant posting permission when required.
3. Save the numeric destination ID as `MKLMS_TELEGRAM_CHAT_ID`.
4. A live batch may override the default destination.

Telegram is optional. Message persistence happens before notification delivery.
