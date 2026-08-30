# MkLMS Cloudflare Free Production Setup

MkLMS is prepared to run on Cloudflare Workers Free using OpenNext. Cloudflare is the intended production edge/runtime; Vercel is a compatibility/test deployment only.

## Runtime

- Node.js development/CI/Vercel/OCI target: Node 24.x.
- Cloudflare production runtime: `workerd` with Node compatibility enabled.
- Local/OpenNext build: `npm run cf:build`
- Local preview: `npm run preview`
- One-command CLI deployment: `npm run deploy`

## Cloudflare dashboard build/deploy settings

When Cloudflare gives you separate **Build command** and **Deploy command** fields, use:

```text
Build command: npm run cf:build
Deploy command: npx opennextjs-cloudflare deploy
```

You may also use `npx wrangler deploy` as the deploy command after `npm run cf:build`, because Wrangler detects OpenNext. The important requirement is that the Build command must create `.open-next` first.

**Do not use `npm run build` as the Cloudflare build command.** `npm run build` creates the normal Next.js `.next` output for Vercel/Node. If you then call an OpenNext/Workers deploy, deployment fails with:

```text
Could not find compiled Open Next config, did you run the build command?
```

That error means the Next build succeeded but the OpenNext bundle was never created.

If the platform provides only one combined deployment command, use:

```text
npm run deploy
```

because the repository's deploy script performs the OpenNext build before deployment.

Prefer npm for Cloudflare to match CI (`npm install --no-audit --no-fund`). Bun can install the project, but npm is the verified dependency/build path.

## Required secrets / variables

Store secrets in Cloudflare Workers settings, never in git. At minimum configure:

- `DATABASE_URL`
- `DATABASE_SSL=require` when your provider requires TLS
- `DATABASE_POOL_MAX=5` initially
- `MKLMS_ADMIN_ACCESS_KEY`
- `MKLMS_ADMIN_SESSION_SECRET`

Optional provider settings are shown inside **Admin → Settings & Integrations** and documented in `.env.example`:

- Telegram: `MKLMS_TELEGRAM_BOT_TOKEN`, `MKLMS_TELEGRAM_CHAT_ID`
- R2/S3 storage: `MKLMS_STORAGE_*`
- protected media: `MKLMS_MEDIA_DELIVERY_BASE_URL`, `MKLMS_MEDIA_SIGNING_SECRET`
- SMTP: `MKLMS_EMAIL_PROVIDER=smtp`, `MKLMS_SMTP_*`, `MKLMS_EMAIL_FROM`

## Database migrations

Do not place migrations in the ordinary Cloudflare/Vercel build command. Builds can run concurrently, be retried, and run for preview environments.

Run migrations explicitly once against a new database:

```bash
export DATABASE_URL='postgresql://...'
export DATABASE_SSL=require
npm run db:migrate
```

The migration runner applies `db/migrations/001...008` in order. The migrations are designed to be safe to re-run where possible, but schema changes should still be treated as a release operation rather than a page-build side effect.

After deployment, **Admin → Settings & Integrations** reports whether PostgreSQL is reachable and whether core MkLMS tables are present.

## PostgreSQL: test now, self-host later

MkLMS uses PostgreSQL as a database engine, not Supabase-specific APIs. `DATABASE_URL` may therefore point to Supabase PostgreSQL for testing and later to self-hosted PostgreSQL.

Cloudflare Hyperdrive is optional and available on Workers Free. When enabled, point Hyperdrive at the same PostgreSQL database and use its connection path for application database traffic. The domain/repository model does not change.

## High-audience webinar state cache

For `CONFIGURED_BASELINE` live classes, `/api/live/*/state` is a shared response: it contains no viewer identity and no attendee-private messages. The response sends a short CDN cache policy and browsers advance deterministic LIVE/chat/CTA timing locally.

Create one Cloudflare **Cache Rule** on the Free plan:

- Match: URI Path starts with `/api/live/` AND URI Path ends with `/state`
- Cache eligibility: Eligible for cache / Cache Everything
- Respect origin/CDN cache-control headers
- Do not include cookies in a custom cache key

Do **not** cache login, claim, playback-authorization, admin, student-session or message POST endpoints.

Measured viewer modes (`ACTIVE_ONLY`, `BASELINE_PLUS_ACTIVE`) remain uncached because they intentionally update/read presence. Use `CONFIGURED_BASELINE` for high-audience broadcasts.

## Private attendee comments

A submitted attendee comment is persisted once in PostgreSQL so the admin inbox remains authoritative and optional Telegram notification still works. The attendee-facing copy is then stored in that browser's `localStorage` (maximum 50 recent comments). Shared live state does not repeatedly retrieve that attendee's private comment history.

## Telegram quick setup

1. Open Telegram and message `@BotFather`.
2. Create a bot with `/newbot` and copy its token to `MKLMS_TELEGRAM_BOT_TOKEN`.
3. Add the bot to the group/channel where you want live-attendee alerts. Give it permission to post when required.
4. Obtain that destination's numeric chat/channel ID and save it as `MKLMS_TELEGRAM_CHAT_ID`.
5. A specific live batch may set its own **Notification destination**, overriding the default ID.

Telegram is optional. Live attendee comments are written to the MkLMS admin inbox first; Telegram failure never deletes the saved comment.

## Video

Do not stream video bytes through the Worker. Course/webinar media should be HLS/static media on object storage + CDN. A production transcode pipeline should process each uploaded source once, write immutable HLS renditions/segments to durable storage (R2 is the preferred delivery store), mark the media asset READY, and reuse those stored outputs for every future viewer. Re-transcode only when the source or encoding profile changes.
