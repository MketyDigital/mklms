# MkLMS — Reusable Learning Platform Agent Blueprint

> **Purpose:** Persistent source-of-truth for agents and developers working on `MketyDigital/mklms`.
> Read this before changing architecture, auth, data models, integrations, media delivery, live-class behavior, deployment or branding.
>
> **Product:** reusable white-label LMS + scheduled simulated-live class platform.
> **Current production-test branch:** `fix/mklms-production-audit`.
> **Legacy webinar reference:** `mkwebinar` — behavior reference only; never merge as-is.
> **Legacy Mkety production repo:** `MketyDigital/Mkety` — READ/REFERENCE ONLY. Never edit it for MkLMS work.

---

## 0. Non-negotiable agent rules

1. MkLMS is reusable and white-label. Never hardcode Starpips, Mkety, Foyzul, one customer, one certificate prefix/domain, one Telegram account or one infrastructure provider into reusable logic.
2. Payments, marketing and acquisition funnels are external. MkLMS begins at preauthorization/enrollment/access.
3. Paid student first claim is preauthorization-only. Preauthorization supports manual add, bulk paste, CSV and future API/webhook adapters.
4. Claim verification is configurable. OTP is optional; supported strategies include preauth-only, claim code, manual approval, email/SMS OTP and custom adapters.
5. Persistent student access code is separate from first-time verification. Access codes and session credentials use secure one-way verification material; sessions are separate random server sessions.
6. **The real browser student endpoints are `/api/access/claim` and `/api/access/login`.** `/api/auth/*` is obsolete and must not be reintroduced.
7. Admin testing auth remains the built-in `MKLMS_ADMIN_ACCESS_KEY` + signed `MKLMS_ADMIN_SESSION_SECRET` session unless a deployment intentionally swaps the auth adapter.
8. Certificate identity is locked at successful claim and is separate from ordinary profile edits.
9. Course access is enrollment-based. Course → Module → Lesson publishing and sequential unlocking remain the learning model.
10. Draft content is invisible to students and does not block progress.
11. MANUAL lessons may be manually completed. VIDEO_PROGRESS lessons require trusted playback progress and cannot use the manual completion endpoint.
12. Trusted video progress requires a server-issued playback grant and cannot credit more progress than credible server elapsed watch time.
13. Certificates are automatic/idempotent at 100% completion and support private storage, optional email, internal-message delivery and public verification.
14. Internal messaging is core and PostgreSQL-backed. Student `/messages` and admin `/admin/messages` must remain real runtime surfaces; do not restore mock message data. Student send is rate-limited as defense in depth.
15. Live classes are scheduled temporary experiences, not registration/payment products. A batch supports 1–3 sessions initially.
16. Server `startsAt` defines the simulated-live timeline. Never use viewer registration time as broadcast time.
17. Before a session: countdown and no LIVE badge. During: visible **LIVE**, current server-clock offset, viewer display, staged timeline/chat and attendee input. After: no LIVE and configured ended behavior.
18. Viewer count is admin-configurable: `CONFIGURED_BASELINE`, `ACTIVE_ONLY` or `BASELINE_PLUS_ACTIVE`. For high audience, prefer `CONFIGURED_BASELINE`.
19. Imported webinar comments are timeline-driven. Admin chat import accepts offset CSV and timestamped/Zoom-style text. Offsets are relative to the session/video start.
20. Real attendee comments are private to that attendee and admin. Other attendees' real comments are never exposed.
21. Real attendee comments are persisted to PostgreSQL before optional notification. Telegram is convenience notification only and must never determine whether the message is saved.
22. Attendee-facing own-comment history is mirrored to bounded browser `localStorage`; shared live state must not repeatedly fetch it from PostgreSQL.
23. High-scale baseline live rooms do not poll every 10 seconds. Shared state is viewer-neutral/cacheable; browser advances deterministic live offset, staged chat and CTA timing locally and resynchronizes at boundaries/visibility plus a low-frequency safety refresh.
24. **No-media live test mode is supported.** An ACTIVE batch with a PUBLISHED active session and no media may show the full LIVE room with viewer count, staged chat, attendee comment UI and CTA timing. The player area clearly says test mode. This must not require media-signing configuration.
25. If a media asset ID is configured but missing/not READY, playback fails closed. No-media test mode must never weaken real-media authorization.
26. Admin `/admin/live-classes` exposes a quick 15-minute test-now action and a prominent per-session **Chat Sync / Import** workflow.
27. Private media origin URLs must not be permanent/public. Course/live playback uses short-lived authorization where supported; HLS protection should cover manifests/segments where the delivery provider supports it.
28. Do not stream large video bytes through PostgreSQL, Next.js or Workers. Media belongs on object storage + CDN.
29. Provider-neutral media is mandatory. OCI Object Storage → OCI Media Flow → R2 → CDN is one deployment path, not a product lock.
30. Automatic OCI Media Flow transcoding is **not yet implemented**. The intended future pipeline is one-time source/profile transcode → permanent immutable HLS in R2/object storage → indefinite reuse. Never claim that automated pipeline is operational until implemented and verified.
31. PostgreSQL is the relational model, not a vendor. Supabase, self-hosted PostgreSQL and compatible managed PostgreSQL remain valid.
32. Storage, email, auth, notification and media integrations remain behind adapters. R2/S3, SMTP/custom email, Telegram/custom notifications and alternative identity providers must not rewrite domain logic.
33. Public/admin-configured external URLs are HTTP(S)-only. Reject javascript/data/file/malformed destinations.
34. All protected admin/student APIs re-check server sessions. SQL remains parameterized. Untrusted inputs remain bounded and sensitive endpoints remain rate-limited.
35. Cloudflare is the primary production edge/runtime target starting on Workers Free. Vercel is a compatibility/test target. Node/OCI remains portable fallback.
36. Node runtime target is 24.x and Next.js is 16.3.3+ security-compatible. CI must verify Node tests, lint, normal Next build and Cloudflare OpenNext build.
37. Hyperdrive is optional and does not change PostgreSQL portability.
38. Database schema changes are explicit release operations. **Do not auto-run migrations inside ordinary Vercel/Cloudflare builds.** Run `npm run db:migrate` with the target DATABASE_URL before/with a release that introduces migrations.
39. Migration history lives in `_mklms_migrations` with SHA-256 checksums. Applied migration files must never be edited; create a new migration instead.
40. Admin Settings must expose integration configured/not-configured status and guidance without returning secret values.
41. Cloudflare dashboard uses **Build command `npm run cf:build`** and then **Deploy command `npx opennextjs-cloudflare deploy`**. `npm run build` alone only creates `.next` and cannot be followed by OpenNext deploy.
42. Never commit credentials, private customer data or media secrets.
43. Every meaningful implementation/testing batch updates this file and the Progress Ledger using PLANNED, IN PROGRESS, IMPLEMENTED, VERIFIED or DEFERRED accurately.

---

## 1. Product surface

```text
MkLMS
├── Public
│   ├── /                     test/access gateway
│   ├── /login                returning student access-code login
│   ├── /onboarding           first-time approved student claim
│   ├── /live/[slug]          scheduled simulated-live room
│   └── /verify/[id]          public certificate verification
├── Student
│   ├── Dashboard
│   ├── Courses → Modules → Lessons
│   ├── Progress
│   ├── Certificates
│   ├── Messages
│   └── Profile
└── Admin
    ├── Dashboard (real DB metrics/actions)
    ├── Access & Enrollments
    ├── Students
    ├── Courses / Modules / Lessons
    ├── Media Library
    ├── Live Classes
    │   ├── quick no-media live test
    │   ├── 1–3 scheduled sessions
    │   ├── viewer baseline/mode
    │   ├── Chat Sync / Import
    │   ├── CTA / ended behavior
    │   └── attendee inbox
    ├── Certificates / Templates
    ├── Internal Messages
    └── Settings & Integrations
```

Out of core: checkout/payment gateways, public webinar registration, acquisition CRM, marketing automation and ad workflows.

---

## 2. Student access lifecycle

```text
External payment/sales
  ↓
Admin preauthorizes paid identity
  ↓
Student /onboarding
  ↓
/api/access/claim
  ↓
match PREAUTHORIZED record + configured claim verification
  ↓
lock certificate identity
  ↓
create student + activate enrollment
  ↓
issue persistent access code once
  ↓
student /login
  ↓
/api/access/login
  ↓
separate hashed server session
  ↓
student dashboard/courses/messages/etc.
```

Suggested enrollment lifecycle:
`PREAUTHORIZED → CLAIMED → ACTIVE → COMPLETED`, with `SUSPENDED` / `REVOKED` controls.

---

## 3. Learning / media / certificate flow

```text
Authenticated student
  ↓
active/completed enrollment
  ↓
published sequential lesson authorization
  ↓
short-lived media playback authorization
  ↓
server playback grant
  ↓
trusted completion/progress
  ↓
100%
  ↓
enrollment COMPLETED
  ↓
idempotent certificate issuance
  ↓
render configured template → private storage
  ↓
optional email + student/admin download + internal message + public verify
```

Media Library supports HLS, direct, external embed/YouTube/custom provider records. The current media admin can register already-prepared assets. Automatic OCI ingest/transcode/copy-to-R2 remains PLANNED.

---

## 4. Live-class model

Normal production flow:

```text
Admin creates batch
  ↓
adds 1–3 sessions
  ↓
sets startsAt + duration + optional media + viewer mode/baseline
  ↓
imports staged chat offsets + CTA + ended behavior
  ↓
activates batch and shares /live/[slug]
```

State resolution:
- `UPCOMING`: countdown, no playback.
- `LIVE`: visible LIVE badge, `serverNow - startsAt` offset, viewer display, staged chat and attendee comment input.
- `BETWEEN_SESSIONS`: countdown to next published session.
- `ENDED`: no playback, configured message/redirect.

### No-media test mode

Admin can click **Start 15-minute live test**. MkLMS creates an ACTIVE test batch and a PUBLISHED 15-minute session that starts immediately with `mediaAssetId = null`. The public room must show the actual LIVE layout and no-media test panel. This is the supported way to test LIVE/viewer/chat/comment behavior before R2/media signing/OCI transcoding is configured.

### Chat Sync / Import

Each session exposes a prominent import section:

```text
Timestamped text:
00:00:10 Ada: Good evening
00:01:05 John: I can hear you

CSV:
offset_seconds,display_name,message
10,Ada,Good evening
65,John,I can hear you
```

The offset is relative to the session/video start. The browser reveals staged messages at the corresponding simulated-live offset.

Real attendee comments are saved once for the admin inbox and optional notification; the attendee sees only their own real comments plus staged chat.

---

## 5. Integrations / environment contract

Admin **Settings & Integrations** reports only configured/not-configured status and required variable names. It must never echo secret values.

### PostgreSQL

```env
DATABASE_URL=
DATABASE_SSL=require
DATABASE_POOL_MAX=5
```

Works with Supabase Free PostgreSQL for testing and self-hosted/managed PostgreSQL later. Hyperdrive is optional on Cloudflare.

### Admin auth

```env
MKLMS_ADMIN_ACCESS_KEY=
MKLMS_ADMIN_SESSION_SECRET=
```

This is the simplest testing/admin auth and does not require a third-party identity service.

### Telegram notifications

```env
MKLMS_TELEGRAM_BOT_TOKEN=
MKLMS_TELEGRAM_CHAT_ID=
```

Setup:
1. Create bot through Telegram `@BotFather`.
2. Save bot token as `MKLMS_TELEGRAM_BOT_TOKEN`.
3. Add bot to the destination group/channel and give required posting permission.
4. Obtain numeric group/channel/user ID and save as `MKLMS_TELEGRAM_CHAT_ID`.
5. A live batch may set a per-batch notification destination, which overrides the default.

Telegram is optional. Persistence occurs before notification; Telegram failure must never lose the attendee message.

### SMTP

```env
MKLMS_EMAIL_PROVIDER=smtp
MKLMS_SMTP_HOST=
MKLMS_SMTP_PORT=587
MKLMS_SMTP_SECURE=false
MKLMS_SMTP_USER=
MKLMS_SMTP_PASSWORD=
MKLMS_EMAIL_FROM=
```

Use `MKLMS_EMAIL_PROVIDER=none` for no-email deployments.

### S3-compatible / Cloudflare R2 storage

```env
MKLMS_STORAGE_BUCKET=
MKLMS_STORAGE_REGION=auto
MKLMS_STORAGE_ENDPOINT=
MKLMS_STORAGE_ACCESS_KEY_ID=
MKLMS_STORAGE_SECRET_ACCESS_KEY=
MKLMS_STORAGE_FORCE_PATH_STYLE=false
```

For R2, use its S3-compatible endpoint plus an R2 API token/access-key pair.

### Protected media delivery

```env
MKLMS_MEDIA_DELIVERY_BASE_URL=
MKLMS_MEDIA_SIGNING_SECRET=
```

These configure the current signed-delivery adapter. No-media live test mode intentionally does not require them.

---

## 6. Database migrations

Migrations live in `db/migrations/001...008`.

Run from a trusted release shell/machine:

```bash
export DATABASE_URL='postgresql://...'
export DATABASE_SSL=require
npm run db:migrate
```

The runner creates `_mklms_migrations`, stores migration filename + SHA-256 checksum + applied timestamp, skips already-applied files, and refuses to continue if an applied migration file has been modified.

Do not attach `npm run db:migrate` to ordinary web builds. Vercel/Cloudflare can execute multiple/retried/preview builds concurrently; migrations are a release operation.

Admin Settings performs a lightweight database/schema health check and reports whether core tables are present.

---

## 7. Deployment contract

### Vercel / Node / OCI

- Node 24.x.
- Build: `npm run build`.
- Vercel is for compatibility/testing; OCI Node/container may later run the same major runtime.

### Cloudflare Workers Free / OpenNext

Cloudflare is the intended production runtime/edge.

When dashboard has separate commands:

```text
Build command: npm run cf:build
Deploy command: npx opennextjs-cloudflare deploy
```

When one command performs both:

```text
npm run deploy
```

Do **not** configure Cloudflare Build as `npm run build` followed by OpenNext deploy. `npm run build` creates `.next`, while OpenNext deployment requires `.open-next`.

For high-audience `CONFIGURED_BASELINE`, add a Cloudflare Free Cache Rule for `/api/live/*/state`; never cache login, claim, playback authorization, admin/session or message mutation endpoints.

---

## 8. Repository strategy

- `main` — deployable consolidated MkLMS.
- `architecture/mklms-reusable-platform` — architecture/spec reference.
- `feature/mklms-phase-1-foundation-access` — verified access foundation.
- `feature/mklms-phase-2-learning-progress` — verified learning/progress.
- `feature/mklms-phase-3-certificates-media` — verified certificates/media/messaging.
- `feature/mklms-phase-4-live-classes` — verified live classes.
- `feature/mklms-pretest-cloudflare-scale` — Node 24/OpenNext/high-audience optimization reference.
- `fix/mklms-production-audit` — current production-test repair before merge.
- `mkwebinar` — legacy behavior reference only.

Design/plan for this audit:
- `docs/superpowers/specs/2026-08-30-mklms-production-audit-repair-design.md`
- `docs/superpowers/plans/2026-08-30-mklms-production-audit-repair.md`

---

## 9. Progress Ledger

| Date | Area | Status | Progress / evidence |
|---|---|---|---|
| 2026-08-30 | Product architecture | VERIFIED | Reusable white-label LMS + temporary scheduled simulated-live system; payments/marketing external. |
| 2026-08-30 | Phase 1 — access | VERIFIED | Secure access codes/sessions, scalable preauthorization, optional verification, admin access management and PostgreSQL foundation. |
| 2026-08-30 | Phase 2 — learning/progress | VERIFIED | Course→Module→Lesson, publishing, enrollment progress, sequential unlock and real student/admin learning UX. |
| 2026-08-30 | Phase 3 — certificates/media | VERIFIED | Idempotent certificates, template renderer/storage/email, protected media/playback grants, trusted video progress, Media Library. |
| 2026-08-30 | Phase 3 — internal messaging | VERIFIED | PostgreSQL student↔admin conversations, student send/admin reply, certificate context and admin inbox. |
| 2026-08-30 | Phase 4 — live classes | VERIFIED | 1–3 sessions, server-clock LIVE state, viewer modes, protected simulated playback, staged chat import, private attendee messages, Telegram adapter, CTA/end behavior. |
| 2026-08-30 | Security/high-view hardening | VERIFIED | URL scheme safety, input bounds, rate limits, security headers, shared baseline state cacheability, local browser live timing/private-comment history. |
| 2026-08-30 | Node/Vercel/Cloudflare compatibility | VERIFIED | Node 24 + Next 16.3.3; CI verifies standard Next build and Cloudflare OpenNext bundle. |
| 2026-08-30 | Legacy cleanup | VERIFIED | Original Foyzul/payment/subscription/mock product surfaces removed/retired from active product; MkLMS system is the only intended product surface. |
| 2026-08-30 | Production audit — student login regression | VERIFIED | Browser forms corrected from obsolete `/api/auth/*` to `/api/access/claim` and `/api/access/login`; regression test added. |
| 2026-08-30 | Production audit — no-media live testing | VERIFIED | Quick 15-minute test-now flow, active no-media LIVE room, visible LIVE/viewer/chat/comment UI, while configured-but-broken media still fails closed. |
| 2026-08-30 | Production audit — live chat sync visibility | VERIFIED | Admin session cards expose prominent Chat Sync / Import UI, format examples, offset semantics and imported count/warnings. |
| 2026-08-30 | Production audit — messaging visibility/security | VERIFIED | Real messaging surfaced from admin dashboard/navigation; PostgreSQL paths contract-tested; student sends now have burst rate limiting. |
| 2026-08-30 | Production audit — admin dashboard | VERIFIED | Hardcoded Foyzul/subscription/payment stats replaced with real DB metrics and direct operational shortcuts. |
| 2026-08-30 | Production audit — integrations/settings | VERIFIED | Database health plus secret-safe configured/not-configured status/guidance for admin auth, Telegram, SMTP, R2/S3 and protected media. |
| 2026-08-30 | Production audit — migrations | VERIFIED | `npm run db:migrate` now tracks `_mklms_migrations` with checksums, skips applied files, rejects edits to applied migrations; migrations remain explicit release operations. |
| 2026-08-30 | Production audit — Cloudflare commands | VERIFIED | Docs/settings lock Cloudflare build=`npm run cf:build`, deploy=`npx opennextjs-cloudflare deploy`; fixes observed `.open-next` missing deploy failure. |
| 2026-08-30 | Production audit automated verification | VERIFIED | Implementation head `cf5f6a799852c971b7c59946109fdd6ee259edaf` passed **126/126 tests, lint, Node 24 Next.js production build, and Cloudflare OpenNext build** in GitHub Actions run `33336563595`. |
| 2026-08-30 | OCI automatic one-time Media Flow → permanent R2 HLS | PLANNED | Architecture is defined but automatic upload/job/event/copy/verification/cleanup adapter is not yet implemented. Current Media Library can use already-prepared HLS/provider assets. |

> **Progress rule:** update this ledger for every meaningful architecture/code/testing batch before considering work complete.
