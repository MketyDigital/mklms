# MkLMS — Reusable Learning Platform Agent Blueprint

> Persistent source of truth for `MketyDigital/mklms`.
> Product: reusable white-label LMS + standalone scheduled simulated-live classes.
> Current feature branch: `feature/mklms-media-ingest-billing`.
> `mkwebinar` is behavior reference only. `MketyDigital/Mkety` is READ/REFERENCE ONLY.

## Non-negotiable product rules

1. MkLMS is reusable and white-label. Never hardcode one customer/brand/provider into reusable domain logic.
2. Payments and acquisition are external. MkLMS begins with preauthorization/access/enrollment.
3. Student browser access uses `/api/access/claim` and `/api/access/login`; `/api/auth/*` is obsolete.
4. First claim requires preauthorization. OTP is optional; claim verification is configurable.
5. Persistent access code and short-lived server session are separate security concepts.
6. Courses use Course → Module → Lesson, enrollment-based access, draft/published state and sequential unlock until completion.
7. Trusted VIDEO_PROGRESS is capped by server-issued playback-grant elapsed time; never trust browser percentage alone.
8. Certificates are idempotent at 100%, use locked claim-time identity, private storage and optional email/internal-message delivery.
9. Internal messaging is core PostgreSQL student↔admin messaging (`/messages`, `/admin/messages`).
10. Live Classes are standalone from paid Courses. A live batch does not require a course/enrollment. Both share platform settings, Media Library, messaging and provider infrastructure.
11. Live batches support 1–3 sessions initially. Server `startsAt` defines the simulated-live clock.
12. Before session: countdown/no LIVE. During: LIVE, server offset, viewer display, staged chat, own attendee comments, CTA. After: no playback and configured ended behavior.
13. No-media live test is supported and does not require media-signing configuration. Configured-but-broken media still fails closed.
14. Staged webinar chat is timeline-driven and importable through timestamp/CSV/Zoom-style text. Real attendee comments are private to that attendee + admin.
15. Viewer modes: `CONFIGURED_BASELINE`, `ACTIVE_ONLY`, `BASELINE_PLUS_ACTIVE`; high-audience broadcasts prefer baseline mode and shared edge-cacheable state.
16. Do not stream large video bytes through PostgreSQL, Next.js or the Cloudflare application Worker.
17. Media providers remain portable. OCI Object Storage → OCI Media Flow → R2 is one deployment path, not a product lock.
18. **OCI Media Flow runs once per source + encoding profile.** Finished immutable HLS is copied to R2 and reused indefinitely for Courses and/or Live Classes. Re-transcode only if source/profile changes.
19. Paid OCI automation defaults OFF. No automatic paid transcode is authorized without an estimate and explicit accepted-cost record.
20. Manual OCI Console/CLI/PAR → one Media Flow job → verify HLS → copy to R2 → verify R2 → register Media Library asset is a supported production path.
21. A media ingest job cannot move to TRANSCODING until cost is accepted, and cannot become READY without an R2 master manifest.
22. Future automation should be: direct OCI upload → Object Create event → Oracle Media Workflow Job Spawner → one Media Flow job → completion event → OCI-side R2 publisher → verification → MkLMS READY callback/status.
23. Do not call automatic OCI→R2 orchestration VERIFIED until a small paid end-to-end smoke test succeeds in the target OCI tenancy/region. Current automation flag remains OFF.
24. PostgreSQL is a database engine, not a vendor. Supabase/self-hosted/managed PostgreSQL remain valid.
25. Database migrations are release operations, not Vercel/Cloudflare/OCI web-build steps.
26. Run `npm run db:status`; if pending, run `npm run db:migrate`; run status again; then deploy. `_mklms_migrations` stores filename/checksum/applied time. Never edit an applied SQL migration.
27. Cloudflare Workers/OpenNext is the primary production runtime. Vercel is compatibility/testing; OCI/Node remains portable and can also host separate installations.
28. Cloudflare dashboard: Build=`npm run cf:build`; Deploy=`npx opennextjs-cloudflare deploy`. `npm run build` alone is not an OpenNext build.
29. Cloudflare Workers Free request/CPU limits mean HLS segment traffic must go directly through media storage/CDN, not the app Worker.
30. Independent customer installations should normally have independent database/env/secrets/storage. Cloudflare and OCI copies may coexist.
31. Integrations remain adapter/config driven. Secret values are never rendered in Admin Settings or committed.
32. Hosting/usage metrics must distinguish **MEASURED** from **ESTIMATED**. Never fabricate usage or provider invoices.
33. Course watch minutes are measured from trusted playback-grant credits. Baseline live audience-minutes are explicitly ESTIMATED (`baseline × session duration`).
34. Managed-hosting fee is a service/management charge, not an infrastructure-cost claim. Deployment settings support configurable min/max/current fee and USDT payment details (TRC20, TON or custom).
35. Security: parameterized SQL, server-side auth, bounded inputs, rate limits, HTTP(S)-only configured URLs, no committed secrets.
36. Every meaningful implementation/testing batch updates this file and verification evidence.

## Runtime integration variables

```env
DATABASE_URL=
DATABASE_SSL=require
DATABASE_POOL_MAX=5
MKLMS_ADMIN_ACCESS_KEY=
MKLMS_ADMIN_SESSION_SECRET=

MKLMS_STORAGE_BUCKET=
MKLMS_STORAGE_REGION=auto
MKLMS_STORAGE_ENDPOINT=
MKLMS_STORAGE_ACCESS_KEY_ID=
MKLMS_STORAGE_SECRET_ACCESS_KEY=
MKLMS_STORAGE_FORCE_PATH_STYLE=false

MKLMS_MEDIA_DELIVERY_BASE_URL=
MKLMS_MEDIA_SIGNING_SECRET=

# Paid OCI media automation stays OFF until smoke-tested.
MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false
MKLMS_OCI_SOURCE_BUCKET=
MKLMS_OCI_OUTPUT_BUCKET=
MKLMS_OCI_MEDIA_WORKFLOW_ID=
MKLMS_R2_MEDIA_BUCKET=

MKLMS_TELEGRAM_BOT_TOKEN=
MKLMS_TELEGRAM_CHAT_ID=

MKLMS_EMAIL_PROVIDER=none
MKLMS_SMTP_HOST=
MKLMS_SMTP_PORT=587
MKLMS_SMTP_SECURE=false
MKLMS_SMTP_USER=
MKLMS_SMTP_PASSWORD=
MKLMS_EMAIL_FROM=
```

## Deployment/release workflow

```text
Choose target installation/database
  ↓
set direct DATABASE_URL in trusted Node 24 release shell
  ↓
npm run db:status
  ↓
if pending: npm run db:migrate
  ↓
npm run db:status
  ↓
Cloudflare production: npm run cf:build → OpenNext deploy
Vercel/Node/OCI: npm run build → deploy runtime
  ↓
Admin Settings DB/integration health check
```

Detailed docs:
- `docs/deployment/database-migrations.md`
- `docs/deployment/cloudflare-free.md`
- `docs/deployment/oci-media-flow-to-r2.md`
- `docs/superpowers/plans/2026-08-30-media-ingest-billing-plan.md`

## Media ingest lifecycle

```text
DRAFT
  ↓ estimate + explicit acceptance
SOURCE_UPLOADED
  ↓
TRANSCODING
  ↓ one OCI Media Flow job
TRANSCODED
  ↓
COPYING_TO_R2
  ↓
VERIFYING
  ↓ master + variants + segments verified in R2
READY
```

Failure may enter `FAILED` and retry only from an intentional stage. Do not automatically fan out duplicate paid jobs.

## Current admin surfaces

- `/admin` — real operational dashboard
- `/admin/access` — preauthorization/enrollment/access
- `/admin/courses` — Courses/Modules/Lessons
- `/admin/media` — Media Library + cost-first OCI→R2 ingest guidance/jobs
- `/admin/live-classes` — standalone live batches/sessions, no-media test, Chat Sync, attendee inbox
- `/admin/messages` — internal student conversations
- `/admin/certificates` + `/admin/certificate-templates`
- `/admin/hosting` — measured/estimated usage + optional managed-hosting payment details
- `/admin/settings` — white-label settings + integration/database health

## Progress Ledger

| Date | Area | Status | Evidence |
|---|---|---|---|
| 2026-08-30 | Phase 1 access | VERIFIED | Secure access/preauthorization/session foundation. |
| 2026-08-30 | Phase 2 learning | VERIFIED | Course/module/lesson, publishing, sequential progress. |
| 2026-08-30 | Phase 3 certificates/media/messages | VERIFIED | Certificates, protected playback/trusted progress, PostgreSQL messaging. |
| 2026-08-30 | Phase 4 live classes | VERIFIED | 1–3 session simulated-live, staged/private chat, viewer modes, Telegram adapter. |
| 2026-08-30 | Production audit | VERIFIED | Access route regression, no-media live test, real dashboard, integration status, migration history, Cloudflare commands. Exact audit head `dd0b8a7c1a9ed4368f74258eadefdf7f9376bbe4` passed CI run `33336737088`. |
| 2026-08-30 | Migration operations | VERIFIED | `db:status`, checksum migration history, explicit cross-platform release runbook, migration `009_mklms_media_ingest_hosting.sql`. |
| 2026-08-30 | Safe media ingest control plane | VERIFIED | Cost estimator, accepted-cost guard, ingest state machine, manual OCI→R2 production runbook, R2-manifest readiness guard. No paid OCI call occurs in CI. |
| 2026-08-30 | Trusted hosting usage | VERIFIED | Per-playback-grant credible watch credits; measured course minutes; baseline live audience-minutes labeled estimated. |
| 2026-08-30 | Managed hosting billing | VERIFIED | `/admin/hosting`; configurable fee range/current charge; USDT TRC20/TON/custom details; service fee separated from provider estimates. |
| 2026-08-30 | Cloudflare production compatibility | VERIFIED | Feature head before this ledger update passed tests, lint, Node 24 Next.js production build and Cloudflare OpenNext build in CI run `33338940687`. |
| 2026-08-30 | Automatic paid OCI Object Create→Media Flow→R2 event orchestration | IN PROGRESS | Architecture/env/guardrails defined and automation defaults OFF. Requires isolated tiny paid smoke test in target OCI tenancy before enabling/marking VERIFIED. |
