# MkLMS Agent Handoff

This file is the current operational source of truth for `MketyDigital/mklms`. Read it before making changes. It records what is shipped, what remains account-side, the intended production architecture, and the next safe starting point.

## Current release state

- Production branch: `main`.
- Integrated release merge: `caa4a9c116a4e11f10498e3f3a2f1a48974d8b0f` (2026-08-31).
- No intended feature PR is left open after the final media/billing/R2 integration.
- The exact integrated release candidate passed domain tests, lint, Next.js production build, OpenNext build, main Worker dry-run, protected-media Worker dry-run, billing Worker dry-run, CodeQL, and a Cloudflare preview build.
- The merged `main` GitHub CI also passed. A Cloudflare production build failed after merge even though the same code built successfully as a preview; treat that as a Cloudflare account/configuration/deploy gate, not as evidence of an application compile failure. Inspect the production Cloudflare build log if it still fails after bindings/secrets are configured.

## Product boundaries that must not regress

1. MkLMS is reusable and white-label. Keep customer/provider specifics out of domain logic.
2. Payments/acquisition are external to the LMS. MkLMS begins at preauthorization/access/enrollment.
3. Built-in admin and student authentication are valid production paths; no external auth vendor is required.
4. Paid Courses require enrollment, published content, sequential/prerequisite access, active session, and protected playback authorization.
5. Live Classes are standalone from Courses and remain public/free only while their scheduled session resolves `LIVE`. They do not require a paid enrollment.
6. The server, not the browser, is authoritative for simulated-live state and playback offset.
7. Protected video bytes never pass through PostgreSQL or the main Next/OpenNext Worker.
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

`APP_STORAGE_BUCKET` is the preferred Cloudflare storage path for certificates/general private application objects. On Cloudflare, S3 access-key env variables are not required merely for this application storage.

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

The current `/admin/media` screen still contains the older OCI ingest control-panel language. Treat replacing that with a portable admin upload/register experience as a follow-up UX/adapter project, not a blocker for the current release. Any implementation of that replacement must preserve provider portability:

- Cloudflare installation: upload/write through the bound private R2 application/storage adapter where appropriate.
- Non-Cloudflare installation: use the configured S3-compatible storage adapter or another provider adapter.
- Protected playback still uses the media-delivery provider; never hand browsers direct private-origin credentials or permanent R2 URLs.

Do not implement this follow-up by editing historical migrations. Design the upload lifecycle separately before coding it.

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
9. Test admin login and student access-code flow.
10. Test one protected direct MP4, including Range seeking.
11. Test a paid lesson authorization/refresh/progress path.
12. Test a public live class before LIVE, during LIVE, and after ENDED.
13. Test certificate object storage/download path.
14. Test managed-hosting manual status controls.
15. If automatic billing is enabled, run a deliberately small real payment and verify settlement only after the verified finished callback.

## Cost/plan principle

The architecture should continue to use free-tier/free-included capabilities whenever usage stays inside those allowances. A paid Cloudflare Workers plan is a capacity/safety margin, not a reason to introduce paid services unnecessarily. Do not design a feature that *requires* paid infrastructure when the same correct architecture can operate within included/free usage at small scale. Scale limits and provider pricing must still be checked before large production loads.

## Next project handoff

After MKLMS production testing begins, the next active repository is `MketyDigital/Trading`, particularly `cloudflare-v2/`. Do not modify `MketyDigital/Mkety` merely to complete the Trading copier project; the main MkSaaS upgrade is a later separate project.

Every meaningful future implementation/testing batch in this repo must update this file with:

- what changed;
- current branch/PR/merge state;
- verification evidence;
- migrations added/run;
- account-side actions still required;
- the exact next safe starting point.
