# MkLMS

MkLMS is a reusable white-label learning platform with student access control, courses and sequential progress, protected media, certificates, internal messaging, and scheduled simulated-live classes/webinars.

## Runtime

- Next.js 16.3.3
- Node.js 24.x
- PostgreSQL (`pg`)
- Cloudflare Workers/OpenNext production target
- Vercel compatibility/test target
- Provider-neutral storage, media, email and notification adapters

## Quick test setup

1. Create a PostgreSQL database. Supabase Free PostgreSQL is fine for testing.
2. Configure the minimum environment variables shown below in Vercel/Cloudflare or `.env.local`.
3. Install dependencies with `npm install`.
4. Run `npm run db:migrate` **once against a new database**. Do not add migrations to the normal web build command.
5. Deploy/redeploy the application.
6. Open `/admin-login` and sign in with `MKLMS_ADMIN_ACCESS_KEY`.
7. Check **Admin → Settings & Integrations**. It reports database/schema health and provider configuration without exposing secrets.
8. Create a course and pre-authorize a test student under **Access & Enrollments**.
9. Open `/onboarding` in an incognito/private browser, claim the approved identity, save the issued student access code, then sign in at `/login`.
10. Test student courses/progress, `/messages`, certificates, and profile.
11. Open **Admin → Live Classes** and click **Start 15-minute live test**. No video is required. Copy the generated public link and verify the LIVE badge, configured viewer count, chat area and private attendee comments.
12. For synchronized staged chat, open the session's **Chat Sync / Import** section and paste timestamped messages such as `00:00:10 Ada: Good evening` or CSV with `offset_seconds,display_name,message`.

### Minimum environment variables

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=require
DATABASE_POOL_MAX=5
MKLMS_ADMIN_ACCESS_KEY=replace-with-a-long-random-admin-key
MKLMS_ADMIN_SESSION_SECRET=replace-with-a-long-random-session-secret
```

### Running migrations

Locally or from a trusted release machine/shell:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE'
export DATABASE_SSL=require
npm run db:migrate
```

The runner applies `db/migrations/001...008` in order. Migrations are a deployment/release operation, not a Vercel or Cloudflare page-build side effect. Running migrations inside every web build risks concurrent build jobs trying to alter the same schema.

## Optional integrations

### Telegram live-comment notifications

```env
MKLMS_TELEGRAM_BOT_TOKEN=
MKLMS_TELEGRAM_CHAT_ID=
```

Create a bot with Telegram `@BotFather`, add it to the target group/channel, and save the token plus destination ID. Each live-class batch may specify a different **Notification destination**; when set, that destination overrides `MKLMS_TELEGRAM_CHAT_ID`. Telegram is optional—the attendee comment is saved to MkLMS before notification is attempted.

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

SMTP is used for optional certificate/transactional delivery. Leave `MKLMS_EMAIL_PROVIDER=none` when you do not want email.

### Cloudflare R2 / S3-compatible storage

```env
MKLMS_STORAGE_BUCKET=
MKLMS_STORAGE_REGION=auto
MKLMS_STORAGE_ENDPOINT=
MKLMS_STORAGE_ACCESS_KEY_ID=
MKLMS_STORAGE_SECRET_ACCESS_KEY=
MKLMS_STORAGE_FORCE_PATH_STYLE=false
```

For R2, use the bucket's S3-compatible endpoint and an R2 API token/access-key pair.

### Protected media delivery

```env
MKLMS_MEDIA_DELIVERY_BASE_URL=
MKLMS_MEDIA_SIGNING_SECRET=
```

These variables configure the current signed-delivery MediaProvider. The media layer is replaceable, so Cloudflare-specific signed delivery or another CDN provider can be supplied without changing course/live-class domain rules.

## Cloudflare Free deployment

For Cloudflare Workers/OpenNext, **do not set the dashboard Build command to `npm run build`**.

Use separate dashboard commands:

```text
Build command: npm run cf:build
Deploy command: npx opennextjs-cloudflare deploy
```

Or use `npm run deploy` when one command is responsible for both building and deploying. `npm run build` is the normal Next.js output for Vercel/OCI; OpenNext deployment requires the `.open-next` bundle produced by `npm run cf:build`.

See `docs/deployment/cloudflare-free.md` for caching, high-view webinar and database guidance.

## Useful commands

```bash
npm run dev
npm test
npm run lint
npm run build
npm run cf:build
npm run db:migrate
npm run deploy
```

## Main product surfaces

- `/` — MkLMS test gateway
- `/login` — student access-code login
- `/onboarding` — first-time approved access claim
- `/dashboard` — student dashboard
- `/courses` — enrolled courses
- `/progress` — learning progress
- `/certificates` — issued certificates
- `/messages` — internal student/admin messaging
- `/profile` — current student identity
- `/admin-login` — administrator key login
- `/admin` — real MkLMS operational dashboard
- `/admin/access` — preauthorization, students and enrollment access
- `/admin/courses` — course/module/lesson management
- `/admin/media` — media library
- `/admin/live-classes` — quick live testing, scheduled sessions, synchronized chat import and attendee inbox
- `/admin/certificates` — certificate operations
- `/admin/messages` — all internal student conversations
- `/admin/settings` — white-label settings, database health and integration status
- `/live/[slug]` — public scheduled live-class room
- `/verify/[certificateId]` — public certificate verification

## Architecture source of truth

Read `agentmklms.md` before changing product boundaries, authentication, media delivery, live-class behavior, tenancy/provider abstractions, or infrastructure decisions.
