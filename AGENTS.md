# MkLMS Agent Handoff

This file is the current operational source of truth for `MketyDigital/mklms`. Read it before making changes. It records what is shipped, what remains account-side, the intended production architecture, and the next safe starting point.

## Current release state

- Production branch: `main`.
- Latest merged media-admin cleanup: `706714a8837029da6f9ffc84b6519c65047049c5` (2026-08-31), from PR `#29`.
- Earlier integrated release merge: `caa4a9c116a4e11f10498e3f3a2f1a48974d8b0f` (2026-08-31).
- The merged `main` media-admin cleanup passed domain tests, lint, Next.js production build, OpenNext build, main Worker dry-run, protected-media Worker dry-run, billing Worker dry-run, and CodeQL.
- Current production-readiness audit is on `fix/production-readiness-audit`, draft PR `#30`; it is not merged into `main` yet.
- No application/database migration was added for the production-readiness audit. Numbered migrations remain `001` through `011`.
- A prior Cloudflare production build had failed even though the same release code built successfully in preview/CI; if production deployment still fails after bindings/secrets are configured, treat that as a Cloudflare account/configuration/deploy gate and inspect the production build log rather than assuming an application compile regression.

## Product boundaries that must not regress

1. MkLMS is reusable and white-label. Keep customer/provider specifics out of domain logic.
2. Payments/acquisition are external to the LMS. MkLMS begins at preauthorization/access/enrollment.
3. Built-in admin and student authentication are valid production paths; no external auth vendor is required.
4. Paid Courses require enrollment, published content, sequential/prerequisite access, active session, and protected playback authorization.
5. Live Classes are standalone from Courses and remain public/free only while their scheduled session resolves `LIVE`. They do not require a paid enrollment.
6. The server, not the browser, is authoritative for simulated-live state and playback offset.
7. Protected video bytes never pass through PostgreSQL or the main Next/OpenNext Worker during playback.
8. Direct private MP4 is the current production media format. HLS application support remains available for future adapters.
9. PostgreSQL is portable: Supabase, self-hosted PostgreSQL, or another compatible managed PostgreSQL are supported.
10. Cloudflare/OpenNext is the primary runtime, while Vercel and normal Node/OCI/VPS remain supported through portable adapters/env variables.
11. Do not expose database credentials, admin secrets, media signing secrets, storage keys, billing secrets, SMTP passwords, or Telegram bot tokens client-side.

## Database migrations: final one-click operator path

The repository currently contains numbered migrations `001` through `011`.

Preferred production operation:

1. GitHub → Actions → **Run MkLMS DB migrations**.
2. Click **Run workflow** on the release branch, normally `main`.
3. Enter `MIGRATE` in the confirmation field.
4. Run it.
5. Require the final **Verify database is current** step to pass before production testing.

Required GitHub Actions secret:

- `MKLMS_DATABASE_URL`

Optional secret:

- `MKLMS_DATABASE_SSL` (workflow defaults to `require` if omitted).

The migration runner is checksum-protected and idempotent at the migration level: already-applied files are skipped; changed historical migration contents cause a hard failure. Never edit an applied migration. Add a new numbered migration instead.

Running the workflow again after the DB is current is safe: all migrations should be reported as already applied/current.

## Current Cloudflare architecture

### Worker 1 — `mklms`

Main LMS/OpenNext application.

Bindings already declared in root `wrangler.jsonc`:

- `ASSETS`
- `HYPERDRIVE_FRESH` → fresh consistency-sensitive PostgreSQL path
- `HYPERDRIVE_CACHED` → explicitly cache-tolerant stable public reads
- `APP_STORAGE_BUCKET` → private R2 bucket `spf-media`

`APP_STORAGE_BUCKET` is the preferred Cloudflare storage path for certificates/general private application objects and admin direct MP4 uploads. On Cloudflare, S3 access-key env variables are not required merely for this application storage.

### Worker 2 — `mklms-media-delivery`

Separate protected media-delivery Worker in `workers/media-delivery/`.

Binding:

- `MEDIA_BUCKET` → private R2 bucket `spf-media`

Required shared secret:

- `MKLMS_MEDIA_SIGNING_SECRET` — exact same value on main app and media Worker.

Optional CORS defense-in-depth variable:

- `MKLMS_MEDIA_ALLOWED_ORIGINS`

The Worker validates the existing short-lived HMAC URL contract and serves private objects with GET/HEAD/Range support. It never exposes an R2 S3 origin URL.

### Worker 3 — `mkety-managed-hosting-billing`

Reusable NOWPayments billing Worker in `workers/billing/`.

It requires no PostgreSQL, Hyperdrive, or R2 binding.

Worker secrets:

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `MKETY_BILLING_CUSTOMERS_JSON`

Main-installation connection variables:

- `MKLMS_BILLING_SERVICE_URL`
- `MKLMS_BILLING_INSTALLATION_ID=spf-mklms`
- `MKLMS_BILLING_SHARED_SECRET`

Only a verified final/finished payment callback may automatically settle a managed-hosting month as paid. Manual PENDING/PAID/WAIVED operator controls remain available.

## R2 layout and security

Current private bucket: `spf-media`.

Keep **Public Access disabled**.

Recommended prefixes:

```text
media/...
certificates/...
app/...
```

Two separate Worker bindings may point to the same private bucket:

- main app `APP_STORAGE_BUCKET`
- protected delivery `MEDIA_BUCKET`

Laptop/operator tools such as Cyberduck/rclone still need separately scoped R2 S3 credentials. Non-Cloudflare app installations can use the portable `MKLMS_STORAGE_*` S3-compatible variables.

## Media direction: direct protected MP4

Current production direction is H.264/AAC MP4 stored privately in R2 and delivered by `mklms-media-delivery` through short-lived signed URLs.

The old OCI Media Flow → R2 ingest system is **not required for current production**. Keep `MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false` unless a future installation deliberately chooses that adapter.

Historical migration 009 and old ingest records are preserved for migration-history integrity. Do not rewrite/remove the migration merely because OCI is no longer the recommended media path.

`/admin/media` now uses the portable direct upload/register path for current production media:

- Cloudflare installation: upload/write through the bound private R2 application/storage adapter.
- Non-Cloudflare installation: use the configured S3-compatible storage adapter or another provider adapter.
- Uploaded MP4s are stored under `media/...`, remain private, and are registered as `DIRECT` media assets using the storage object reference rather than a permanent public URL.
- Existing private MP4/HLS objects can be browsed from the configured storage adapter and registered into the MkLMS media library without moving or re-uploading the object.
- Existing media records and supported source types remain intact, including `DIRECT`, `HLS`, `YOUTUBE`, `EXTERNAL_EMBED`, and `CUSTOM`.
- Protected playback still uses the separate media-delivery provider; never hand browsers direct private-origin credentials or permanent R2 URLs.
- Operator-uploaded R2 objects remain valid and unchanged; after registration, the same media record is available to both Courses and Live Classes.

The older OCI ingest implementation and historical records remain in the repository for migration/history compatibility, but the OCI control panel and active ingest-state querying are no longer part of the active `/admin/media` production workflow. Do not remove or rewrite historical migration 009 as part of future cleanup.

## Live-class media behavior to preserve

Public `/live/[slug]` is free without enrollment, but playback authorization is issued only while the server resolves the batch/session state as `LIVE`.

Flow:

```text
/live/[slug]
  → /api/live/[slug]/state
  → state == LIVE
  → POST /api/live/[slug]/playback
  → short-lived signed DIRECT media URL
  → video loads private MP4
  → player seeks to server-authoritative live offset
```

The live client refreshes authorization before expiry. After the live window ends, no new authorization should be issued; an already-issued URL can only remain usable until its short expiry.

Paid course playback keeps its separate enrollment/session/course/lesson authorization rules.

## Authoritative configuration docs

Use these together:

- `README.md` — current project overview and operator-facing production path.
- `docs/deployment/environment-variables.md` — authoritative host-by-host env/binding reference.
- `.env.cloudflare.example` — concrete three-Worker Cloudflare setup checklist.
- `.env.example` — portable application env template.
- `docs/deployment/r2-storage-layout.md` — R2 binding/layout guidance.
- `docs/deployment/external-managed-hosting-billing.md` — billing flow.
- `workers/media-delivery/README.md` — protected-media Worker behavior/setup.
- `workers/billing/README.md` — billing Worker behavior/setup.

`agentmklms.md` contains historical architecture/progress notes and may mention the previously preferred OCI ingest path. This `AGENTS.md` is newer and takes precedence when the two disagree.

## Production setup/test gate

Before calling a real environment production-ready:

1. Create/deploy `mklms-media-delivery` and set its media signing secret.
2. Create/deploy `mkety-managed-hosting-billing` and set its NOWPayments/customer-registry secrets if automatic managed billing is wanted.
3. Configure the main `mklms` variables from `.env.cloudflare.example`.
4. Confirm main bindings include both Hyperdrives, `ASSETS`, and `APP_STORAGE_BUCKET → spf-media`.
5. Confirm media Worker has `MEDIA_BUCKET → spf-media`.
6. Keep R2 public access disabled.
7. Run GitHub DB migrations with `MIGRATE`; require final status green.
8. Redeploy `mklms`; require the Cloudflare production build/deploy to pass.
9. Test Admin → Media: verify existing private R2 MP4s appear, register one, and confirm the same media record appears in Courses and Live Classes.
10. Test student access end-to-end: preauth-only, one-time claim-code, manual-approval request/approve/retry, issued persistent access-code login, and course enrollment visibility.
11. Test a paid lesson authorization/refresh/progress path and protected Range seeking.
12. Test a public live class before LIVE, during LIVE, and after ENDED using registered private media.
13. Test Messages unread behavior and admin/student reply synchronization.
14. Test certificate-template upload, certificate issuance/private object storage/download, and public verification.
15. Test Settings save plus database/storage/media health cards on the production Cloudflare bindings.
16. Test managed-hosting manual status controls.
17. If automatic billing is enabled, run a deliberately small real payment and verify settlement only after the verified finished callback.

## Cost/plan principle

The architecture should continue to use free-tier/free-included capabilities whenever usage stays inside those allowances. A paid Cloudflare Workers plan is a capacity/safety margin, not a reason to introduce paid services unnecessarily. Do not design a feature that *requires* paid infrastructure when the same correct architecture can operate within included/free usage at small scale. Scale limits and provider pricing must still be checked before large production loads.

## Final media-admin cleanup handoff

- Production merge: `706714a8837029da6f9ffc84b6519c65047049c5` on `main`, merged from PR `#29`.
- Starting production SHA before cleanup: `62a979bfd40e26e6468e48c5aeb2e5fb4ce67872`.
- Change: removed the active OCI Media Flow control panel/querying from `/admin/media`; added direct private MP4 upload through the existing configured storage adapter; uploaded objects use `media/...`; successful uploads register existing `DIRECT` media records; failed DB registration performs best-effort object cleanup.
- Scope audit: the implementation diff was limited to `AGENTS.md`, `src/app/(admin)/admin/media/page.tsx`, `src/app/api/admin/media/upload/route.ts`, `src/features/media/components/media-upload-panel.tsx`, and `tests/admin-media-upload.test.mjs`. No migration, playback provider, media-delivery Worker, course, live-class, auth, certificate, billing, or database-architecture file changed in that implementation.
- TDD evidence: the first admin-media contract commit failed the GitHub `Domain tests` step before implementation, as intended.
- Verification: merged `main` commit `706714a8837029da6f9ffc84b6519c65047049c5` passed domain tests, lint, Next.js production build, Cloudflare OpenNext build, main Worker dry-run, protected-media Worker dry-run, billing Worker dry-run, and CodeQL.
- Migrations added/run for this cleanup: none. Existing numbered migrations `001`–`011`, including historical migration 009, were not changed by the implementation.
- Account-side action specific to this code change: none beyond the existing production requirement that `APP_STORAGE_BUCKET` (or the portable S3-compatible adapter) is configured and private.
- Exact next safe starting point: run the one-click GitHub DB migration workflow with `MIGRATE`, require **Verify database is current** to pass, then begin the production test gate. Existing R2 videos do not need re-uploading.

## Production-readiness audit handoff — PR #30

- Branch: `fix/production-readiness-audit`.
- Pull request: draft PR `#30` (`fix: production readiness audit`), open and not merged. Integration/merge remains an explicit user decision.
- Production base for the audit: `3900c5add2818493be4bb2fb60c72da882185e06` on `main`.
- Implementation head verified before this handoff-only update: `b4a7dd47e9dd0dd31715ef38f00a95d25d95905b`.
- Primary production failures addressed:
  - Cloudflare Hyperdrive adapter now supports dedicated transaction clients used by access-code credential creation/reset and live staged-chat replacement.
  - Manual-approval claims record the request and allow the approved student to retry successfully.
  - Student login uses the documented `MKLMS_STUDENT_SESSION_TTL_SECONDS` variable.
  - Student onboarding uses saved claim settings and always permits a per-student one-time claim code when one was issued.
  - Admin Access loads real Courses; single and bulk preauthorization validate course IDs so a typo cannot create a credential attached to a nonexistent course. Deliberate portal-only access remains supported.
  - Admin Media can list compatible MP4/HLS files already present in private R2/S3-compatible storage and register them without moving/re-uploading. Registered records are shared by Courses and Live Classes.
  - Active Media/Settings/Hosting UI no longer exposes OCI Media Flow or active OCI ingest accounting. Historical OCI code/migration 009 remain for history/checksum compatibility.
  - Legacy saved `storage_provider=oci` / `media_provider=oci-media-flow` values are normalized when loading active Settings so old production rows do not block saves.
  - Settings database health now recognizes the actual reachable Hyperdrive runtime instead of incorrectly requiring `DATABASE_URL` on Cloudflare.
  - Live Class share URLs use saved `publicBaseUrl`.
  - Admin Messages no longer mark every thread read when the page opens; conversations load lazily and only the opened thread is marked read.
  - Hosting retains useful migration-recovery guidance but no free-deployment tutorial or OCI processing card.
- Feature audit performed against the same production wiring:
  - Admin Home/navigation; Access & Enrollments; Students; Courses; Media; Live Classes; Certificates; Certificate Templates; Messages; Hosting & Usage; Settings.
  - Student claim/login/session/enrollment; paid course locking/progress/playback; public live state/playback; certificate issuance/delivery/verification; messaging; managed-hosting checkout/settlement; protected media Range delivery.
- TDD evidence:
  - initial production-readiness test commit failed Domain tests before implementation;
  - later focused red runs caught per-student claim-code, unread-message, Settings/Hyperdrive, and course-assignment gaps before their fixes.
- Verification evidence for implementation head `b4a7dd47e9dd0dd31715ef38f00a95d25d95905b`: GitHub Actions run `33432972943` passed Domain tests, lint, Next.js production build, Cloudflare OpenNext build, main Worker packaging dry-run, protected-media Worker packaging dry-run, and external billing Worker packaging dry-run.
- A preceding run `33432486855` independently confirmed the R2 browser lint fix plus the same full build/three-Worker packaging chain.
- Migrations added/changed: none. Numbered migrations remain `001`–`011`; migration 009 remains unchanged.
- Account-side actions still required: after explicit merge approval, deploy/redeploy the main app and run the production smoke-test gate above against the real Cloudflare/PostgreSQL/R2 environment. Private browser interactions and a real NOWPayments settlement cannot be proven by CI alone.
- Exact next safe starting point: require CI on the final PR head to be green, review PR `#30`, merge only with explicit user approval, deploy, then run the production smoke-test gate beginning with Admin → Media existing-R2 registration and the student claim/login/enrollment flow.

## Next project handoff

After MKLMS production testing begins, the next active repository is `MketyDigital/Trading`, particularly `cloudflare-v2/`. Do not modify `MketyDigital/Mkety` merely to complete the Trading copier project; the main MkSaaS upgrade is a later separate project.

Every meaningful future implementation/testing batch in this repo must update this file with:

- what changed;
- current branch/PR/merge state;
- verification evidence;
- migrations added/run;
- account-side actions still required;
- the exact next safe starting point.
