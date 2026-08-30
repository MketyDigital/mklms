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
2. Copy the environment variables below into `.env.local` for local testing or into Vercel/Cloudflare deployment secrets.
3. Run `npm install`.
4. Run `npm run db:migrate` once against the database.
5. Run `npm run dev` locally, or redeploy Vercel/Cloudflare after setting environment variables.
6. Open `/admin-login`, sign in with `MKLMS_ADMIN_ACCESS_KEY`, create a course, then pre-authorize a test student in **Access & Enrollments**.
7. Open `/onboarding` in a private/incognito browser, claim that approved identity, save the issued access code, then use it at `/login`.

### Minimum environment variables

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=require
MKLMS_ADMIN_ACCESS_KEY=replace-with-a-long-random-admin-key
MKLMS_ADMIN_SESSION_SECRET=replace-with-a-long-random-session-secret
```

For protected media/live-class playback, also configure the selected MediaProvider variables. For optional SMTP/Telegram/object-storage providers, configure only the adapter being tested.

## Useful commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run cf:build
npm run db:migrate
```

## Main product surfaces

- `/` — MkLMS test gateway
- `/login` — student access-code login
- `/onboarding` — first-time approved access claim
- `/dashboard` — student dashboard
- `/courses` — enrolled courses
- `/progress` — learning progress
- `/certificates` — issued certificates
- `/messages` — student/admin messaging
- `/profile` — current student identity
- `/admin-login` — administrator key login
- `/admin` — administration
- `/admin/access` — preauthorization, students and enrollment access
- `/admin/courses` — course/module/lesson management
- `/admin/media` — media library
- `/admin/live-classes` — scheduled simulated-live classes
- `/admin/certificates` — certificate operations
- `/admin/messages` — all conversations
- `/admin/settings` — white-label/platform settings
- `/live/[slug]` — public scheduled live-class room
- `/verify/[certificateId]` — public certificate verification

## Architecture source of truth

Read `agentmklms.md` before changing product boundaries, authentication, media delivery, live-class behavior, tenancy/provider abstractions, or infrastructure decisions.

