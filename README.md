# MkLMS

MkLMS is a reusable white-label learning platform with student access control, courses and sequential progress, protected media, certificates, internal messaging, scheduled simulated-live classes/webinars, private object storage, and optional managed-hosting billing.

> **Start here for project continuity:** read [`AGENTS.md`](AGENTS.md) before changing architecture, security boundaries, media, storage, migrations, billing, or deployment behavior. It is the current handoff/source of truth.

## Runtime

- Next.js 16.3.3
- Node.js 24.x
- PostgreSQL (`pg`)
- Cloudflare Workers/OpenNext primary production target
- Vercel and normal Node/OCI/VPS portability
- Provider-neutral storage, media, email and notification adapters

## Current Cloudflare layout

The current production architecture uses three Workers:

1. `mklms` — the main OpenNext LMS application.
2. `mklms-media-delivery` — protected private video delivery from R2.
3. `mkety-managed-hosting-billing` — reusable NOWPayments cc managed-hosting billing service.

The main Worker binds:

- `HYPERDRIVE_FRESH`
- `HYPERDRIVE_CACHED`
- `ASSETS`
- `APP_STORAGE_BUCKET` → private R2 bucket `spf-media`

The media Worker separately binds:

- `MEDIA_BUCKET` → the same private R2 bucket `spf-media`

Keep R2 **Public Access disabled**. Protected media is delivered only through short-lived signed authorization URLs; the browser is never given a permanent R2 origin URL.

## Database migrations

The preferred non-technical production path is the manual GitHub Action **Run MkLMS DB migrations**.

1. Configure repository/environment secret `MKLMS_DATABASE_URL`.
2. Optionally configure `MKLMS_DATABASE_SSL=require`.
3. GitHub → **Actions → Run MkLMS DB migrations → Run workflow**.
4. Select the release branch, normally `main`.
5. Type `MIGRATE` and run it.
6. Require **Verify database is current** to pass.

The repository currently contains migrations `001` through `011`. The runner applies only unapplied migrations, records SHA-256 checksums, skips already-current migrations, and fails if an already-applied migration file was changed. Do not edit historical applied migrations; add a new numbered migration instead.

Running the workflow again after the database is current is safe: already-applied migrations are skipped.

Manual trusted-shell alternative:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE'
export DATABASE_SSL=require
npm run db:status
npm run db:migrate
npm run db:status
```

Migrations are database release operations, not Cloudflare/Vercel page-build steps.

## Minimum application environment

See [`docs/deployment/environment-variables.md`](docs/deployment/environment-variables.md) for the authoritative host-by-host reference and [`.env.cloudflare.example`](.env.cloudflare.example) for the current three-Worker Cloudflare checklist.

Core values include:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=require
DATABASE_POOL_MAX=5
MKLMS_ADMIN_ACCESS_KEY=replace-with-a-long-random-admin-key
MKLMS_ADMIN_SESSION_SECRET=replace-with-a-different-long-random-session-secret
```

Protected media additionally requires on the main app:

```env
MKLMS_MEDIA_DELIVERY_BASE_URL=https://YOUR-MEDIA-WORKER.workers.dev
MKLMS_MEDIA_SIGNING_SECRET=replace-with-a-long-random-shared-secret
```

The exact same `MKLMS_MEDIA_SIGNING_SECRET` must be configured on the media Worker.

## Media: current production path

The current recommended format is **direct H.264/AAC MP4 in private R2**, delivered through `mklms-media-delivery`.

For compatible Zoom MP4 recordings, transcoding is not required simply to store/play them in MkLMS. If browser-start optimization is needed, Fast Start can be applied without re-encoding:

```bash
ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
```

Use opaque private object keys such as:

```text
media/transformation-program/module-01/lesson-01.mp4
```

and register that key as the media provider asset reference. Do not register a public R2 URL.

### Admin media upload

`/admin/media` now supports direct protected MP4 upload through the existing provider-neutral storage adapter.

- Cloudflare deployments write through the bound private `APP_STORAGE_BUCKET` R2 adapter.
- Non-Cloudflare deployments can use the configured S3-compatible storage adapter or another provider adapter.
- New uploads are written under `media/...`, remain private, and are registered as `DIRECT` media assets.
- Existing media records and supported source types remain intact, including `DIRECT`, `HLS`, `YOUTUBE`, `EXTERNAL_EMBED`, and `CUSTOM`.
- Protected playback continues through `mklms-media-delivery`; browsers are not given permanent R2 origin URLs or private storage credentials.

Videos uploaded directly to R2 by an operator remain valid and can continue to be registered by their private object key; the admin upload form is an additional convenience path, not a replacement for existing stored objects.

### OCI Media Flow

OCI Media Flow → R2 is now a **legacy/optional adapter path**, not part of the active production Admin → Media workflow. Keep:

```env
MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false
```

unless a future installation deliberately chooses that adapter.

Historical migration 009 and its ingest-job model remain intact for migration-history safety. The older OCI implementation is retained only for history/compatibility; the visible OCI Media Flow control panel and active ingest-state querying were removed from `/admin/media`.

## Live classes

Live Classes are standalone from paid Courses.

- Public `/live/[slug]` does not require student enrollment.
- The page checks server-authoritative live state.
- Protected playback authorization is issued only while the scheduled session is `LIVE`.
- The video player seeks to the server-authoritative simulated-live offset.
- After the session ends, no new playback authorization is issued.
- Paid Course playback retains its separate enrollment/session/lesson authorization rules.

This allows free scheduled simulated-live sessions without turning the underlying private media file into permanent public media.

## Optional managed-hosting billing

The main app supports manual managed-hosting month states and an optional separate billing Worker for automated NOWPayments settlement.

Main-app connection variables:

```env
MKLMS_BILLING_SERVICE_URL=
MKLMS_BILLING_INSTALLATION_ID=spf-mklms
MKLMS_BILLING_SHARED_SECRET=
```

Billing Worker secrets:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
MKETY_BILLING_CUSTOMERS_JSON
```

See [`docs/deployment/external-managed-hosting-billing.md`](docs/deployment/external-managed-hosting-billing.md).

## Optional integrations

### Telegram notifications

```env
MKLMS_TELEGRAM_BOT_TOKEN=
MKLMS_TELEGRAM_CHAT_ID=
```

### SMTP email

```env
MKLMS_EMAIL_PROVIDER=smtp
MKLMS_SMTP_HOST=
MKLMS_SMTP_PORT=587
MKLMS_SMTP_SECURE=false
MKLMS_SMTP_USER=
MKLMS_SMTP_PASSWORD=
MKLMS_EMAIL_FROM=
```

Leave `MKLMS_EMAIL_PROVIDER=none` when SMTP is not wanted.

### Portable S3-compatible application storage

Cloudflare production now prefers the native `APP_STORAGE_BUCKET` binding for certificates/general private application objects. For Vercel/OCI/VPS or another non-Cloudflare host, the portable S3-compatible fallback remains:

```env
MKLMS_STORAGE_BUCKET=
MKLMS_STORAGE_REGION=auto
MKLMS_STORAGE_ENDPOINT=
MKLMS_STORAGE_ACCESS_KEY_ID=
MKLMS_STORAGE_SECRET_ACCESS_KEY=
MKLMS_STORAGE_FORCE_PATH_STYLE=false
```

Laptop/operator uploads through Cyberduck/rclone also require separately scoped R2 API credentials; Worker bindings do not authenticate local software.

## Cloudflare deployment

For the main OpenNext Worker:

```text
Node: 24.x
Production branch: main
Root directory: /
Build command: npm run cf:build
Deploy command: npx opennextjs-cloudflare deploy
```

Do not use plain `npm run build` as the Cloudflare OpenNext deployment build.

Auxiliary Workers deploy with their explicit Wrangler configs:

```bash
npx wrangler deploy --config workers/media-delivery/wrangler.jsonc
npx wrangler deploy --config workers/billing/wrangler.jsonc
```

The system is designed to use included/free-tier capabilities whenever usage remains within provider allowances. A paid Workers plan can provide capacity/safety margin without making paid-only infrastructure a product requirement.

## Useful commands

```bash
npm run dev
npm test
npm run lint
npm run build
npm run cf:build
npm run db:status
npm run db:migrate
npm run deploy
```

## Main product surfaces

- `/login` — student access-code login
- `/onboarding` — first approved access claim
- `/dashboard` — student dashboard
- `/courses` — enrolled courses
- `/progress` — learning progress
- `/certificates` — issued certificates
- `/messages` — internal student/admin messaging
- `/profile` — current student identity
- `/admin-login` — administrator login
- `/admin` — operational dashboard
- `/admin/access` — preauthorization/students/enrollments
- `/admin/courses` — course/module/lesson management
- `/admin/media` — reusable media library with direct private MP4 upload/register plus existing manual media registration
- `/admin/live-classes` — scheduled simulated-live sessions and attendee operations
- `/admin/certificates` — certificate operations
- `/admin/messages` — student conversations
- `/admin/hosting` — managed-hosting status/billing operations
- `/admin/settings` — white-label settings and integration/database health
- `/live/[slug]` — public scheduled live-class room
- `/verify/[certificateId]` — public certificate verification

## Project continuity

Read [`AGENTS.md`](AGENTS.md) first. It records the current release state, verified architecture, production setup gates, account-side actions, media direction, and exact next safe starting point.

`agentmklms.md` is retained as historical architecture/progress context, but `AGENTS.md` takes precedence where older decisions differ.
