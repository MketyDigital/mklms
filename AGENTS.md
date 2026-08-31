# MkLMS Agent Handoff

This file is the current operational source of truth for `MketyDigital/mklms`. Read it before making changes. It records shipped architecture, invariants, deployment bindings, migration procedure, account-side production gates, and the next safe starting point.

## Current release / work state

- Production branch: `main`.
- Last fully merged handoff baseline before this media cleanup: `62a979bfd40e26e6468e48c5aeb2e5fb4ce67872` (2026-08-31).
- Current scoped implementation branch: `feature/admin-storage-media-upload`, PR #27.
- PR #27 changes only the obsolete admin OCI ingest experience into a provider-neutral private-storage multipart upload flow. It must not change auth, playback authorization, courses, live classes, billing, certificates, messaging, or historical migrations.
- The approved design is `docs/superpowers/specs/2026-08-31-admin-storage-media-upload-design.md`.
- The execution plan is `docs/superpowers/plans/2026-08-31-admin-storage-media-upload.md`.

Update this section after PR #27 is verified/merged with its final merge SHA and CI evidence.

## Product boundaries that must not regress

1. MkLMS is reusable and white-label. Keep customer/provider specifics out of domain logic.
2. Payments/acquisition are external to the LMS. MkLMS begins at preauthorization/access/enrollment.
3. Built-in admin and student authentication are valid production paths; no external auth vendor is required.
4. Paid Courses require enrollment, published content, sequential/prerequisite access, active session, and protected playback authorization.
5. Live Classes are standalone from Courses and remain public/free only while their scheduled session resolves `LIVE`; no paid enrollment is required for the live room.
6. The server, not the browser, is authoritative for simulated-live state and playback offset.
7. Protected video bytes never pass through PostgreSQL and are not proxied through the main OpenNext application Worker for viewer playback.
8. Direct private H.264/AAC MP4 is the current production media format. HLS remains a future-compatible adapter option.
9. PostgreSQL is portable: Supabase, self-hosted PostgreSQL, or another compatible managed PostgreSQL are valid.
10. Cloudflare/OpenNext is the primary runtime, while Vercel and normal Node/OCI/VPS remain supported through portable adapters/env variables.
11. Never expose database credentials, admin secrets, media signing secrets, storage keys, billing secrets, SMTP passwords, Telegram bot tokens, or permanent private-storage URLs client-side.
12. Never edit an applied migration. Add a new numbered migration when schema changes are genuinely required.

## Database migrations: final one-click operator path

The repository contains numbered migrations `001` through `011`. PR #27 does **not** require a new migration and must leave migrations 001–011 byte-for-byte unchanged.

Preferred production operation:

1. GitHub → Actions → **Run MkLMS DB migrations**.
2. Click **Run workflow** on `main`.
3. Enter `MIGRATE`.
4. Run it.
5. Require the final **Verify database is current** step to pass.

Required GitHub Actions secret: `MKLMS_DATABASE_URL`.
Optional: `MKLMS_DATABASE_SSL` (defaults to `require`).

The runner records SHA-256 checksums, skips already-applied migrations, and hard-fails if historical migration contents changed. Re-running it when current is safe.

## Current Cloudflare architecture

### Worker 1 — `mklms`

Main Next.js/OpenNext LMS application.

Bindings declared in root `wrangler.jsonc`:

- `ASSETS`
- `HYPERDRIVE_FRESH`
- `HYPERDRIVE_CACHED`
- `APP_STORAGE_BUCKET` → private R2 bucket `spf-media`

`APP_STORAGE_BUCKET` is used for Cloudflare-native private application storage: admin media uploads, certificates, and other application-managed objects. The Cloudflare main Worker does not need R2 S3 access-key env variables for these operations when this binding is present.

### Worker 2 — `mklms-media-delivery`

Separate protected media Worker under `workers/media-delivery/`.

Binding:
- `MEDIA_BUCKET` → private R2 bucket `spf-media`

Required secret:
- `MKLMS_MEDIA_SIGNING_SECRET` — identical on main app and media Worker.

Optional:
- `MKLMS_MEDIA_ALLOWED_ORIGINS`

This Worker validates the existing short-lived HMAC contract and serves GET/HEAD/Range responses. It does not expose a permanent R2 S3 origin.

### Worker 3 — `mkety-managed-hosting-billing`

Reusable NOWPayments billing Worker under `workers/billing/`.

No PostgreSQL, Hyperdrive, or R2 binding.

Secrets:
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `MKETY_BILLING_CUSTOMERS_JSON`

Main installation variables:
- `MKLMS_BILLING_SERVICE_URL`
- `MKLMS_BILLING_INSTALLATION_ID=spf-mklms`
- `MKLMS_BILLING_SHARED_SECRET`

Only verified final/finished payment callbacks may automatically mark a managed-hosting month PAID. Manual PENDING/PAID/WAIVED controls remain.

## Private storage / R2 layout

Current bucket: `spf-media`. Keep **Public Access disabled**.

Recommended logical prefixes:

```text
media/uploads/...
media/...          # operator/manual existing media keys
certificates/...
app/...
```

The same private bucket may safely have two bindings because they have different application roles:

- main `APP_STORAGE_BUCKET` → writes/admin application storage;
- media `MEDIA_BUCKET` → protected viewer delivery.

Laptop tools such as Cloudflare dashboard upload, Cyberduck, or rclone are still valid operator paths. Cyberduck/rclone require separately scoped R2 S3 credentials; dashboard upload does not. For a media file uploaded outside MkLMS, use **Register media asset** and store only its opaque object key, not an R2 URL.

## Active media workflow: Admin upload -> private storage -> protected DIRECT playback

The normal admin path after PR #27 is:

```text
/admin/media
  ↓ Upload private MP4
  ↓ create multipart session
  ↓ 10 MiB browser chunks
configured StorageProvider
  ├─ Cloudflare: APP_STORAGE_BUCKET native R2 multipart
  └─ other hosts: S3-compatible multipart adapter
  ↓
server-owned media/uploads/YYYY/MM/<uuid>-<safe-name>.mp4
  ↓
automatic Media Library registration
     provider=storage
     sourceType=DIRECT
     status=READY
  ↓
course/live playback still uses existing signed MediaProvider
  ↓
mklms-media-delivery -> MEDIA_BUCKET -> private object
```

Security rules:
- existing admin session required for create/upload-part/complete/abort;
- simple admin upload accepts MP4 only;
- server generates and validates the storage prefix/key;
- browser never receives R2/S3 credentials or permanent private-object URL;
- multipart upload avoids routing a 200–300 MB file as one giant Worker request;
- if media DB registration fails after storage completion, the API attempts to delete the completed object;
- manual media registration remains for dashboard-uploaded media and external/custom providers.

No playback authorization logic changes as part of this feature.

## OCI Media Flow status

OCI Media Flow -> R2 is **legacy/optional**, not the normal production path. Historical migration 009, ingest tables, and legacy adapter code remain for checksum/backward-compatibility safety. Do not delete or rewrite migration 009.

`MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false` may remain on old installations but is not required by the active admin upload path. A future installation can deliberately add a transcoding adapter if adaptive HLS is needed.

## Live-class media behavior to preserve

Public `/live/[slug]` remains free without enrollment. Playback authorization is issued only while server state is `LIVE`.

```text
/live/[slug]
  -> /api/live/[slug]/state
  -> state == LIVE
  -> POST /api/live/[slug]/playback
  -> short-lived signed DIRECT media URL
  -> media Worker
  -> private MP4
  -> seek to server-authoritative live offset
```

Authorization lifetime is capped to the remaining scheduled session time. Before LIVE, between sessions, and after ENDED, no new playback authorization is issued. Paid Course playback keeps its independent enrollment/session/lesson rules.

## Storage portability

Cloudflare:
- native `APP_STORAGE_BUCKET` for admin uploads/certificates/app objects;
- native `MEDIA_BUCKET` on the separate protected delivery Worker.

Vercel/OCI/VPS/normal Node:
- `MKLMS_STORAGE_BUCKET`
- `MKLMS_STORAGE_REGION`
- `MKLMS_STORAGE_ENDPOINT`
- `MKLMS_STORAGE_ACCESS_KEY_ID`
- `MKLMS_STORAGE_SECRET_ACCESS_KEY`
- `MKLMS_STORAGE_FORCE_PATH_STYLE`

The admin upload UI is the same; only the storage adapter changes.

## Authoritative configuration/docs

- `.env.cloudflare.example` — three-Worker Cloudflare checklist.
- `.env.example` — portable application template.
- `docs/deployment/environment-variables.md` — host-by-host env/binding reference.
- `docs/deployment/r2-project-layout.md` — private storage/media layout and upload guidance.
- `docs/deployment/external-managed-hosting-billing.md` — billing flow.
- `workers/media-delivery/README.md` — protected delivery Worker.
- `workers/billing/README.md` — billing Worker.
- `docs/superpowers/specs/2026-08-31-admin-storage-media-upload-design.md` — approved current media-upload contract.

`agentmklms.md` is historical progress context. This `AGENTS.md` takes precedence where older OCI/media decisions differ.

## Production setup/test gate

Before calling a real environment production-ready:

1. Run GitHub DB migration action with `MIGRATE`; require current/green.
2. Deploy `mklms-media-delivery`; set the shared media signing secret; confirm `MEDIA_BUCKET -> spf-media`.
3. Deploy `mkety-managed-hosting-billing` if automatic billing is wanted.
4. Configure main `mklms` from `.env.cloudflare.example`.
5. Confirm main bindings: `ASSETS`, both Hyperdrives, `APP_STORAGE_BUCKET -> spf-media`.
6. Keep R2 Public Access disabled.
7. Redeploy main `mklms`; require production build/deploy green.
8. Test admin login and student access-code flow.
9. Test `/admin/media` upload with one real MP4 and also manual registration of an already dashboard-uploaded MP4.
10. Test Range seeking and authorization refresh in a paid lesson.
11. Test a public live class before LIVE, during LIVE, and after ENDED.
12. Test certificate private storage/download.
13. Test manual managed-hosting PENDING/PAID/WAIVED.
14. If automatic billing is enabled, use a deliberately small real NOWPayments invoice and verify only a finished callback settles PAID.

## Cost/plan principle

Prefer free/included capabilities while usage remains inside allowances. A paid Cloudflare Workers plan is capacity/headroom, not permission to introduce unnecessary paid dependencies.

## Next project handoff

After this scoped media cleanup is verified and merged and MKLMS production testing begins, move to `MketyDigital/Trading`, active implementation `cloudflare-v2/`. Read that repo's `AGENTS.md` first. The broader MkSaaS upgrade in `MketyDigital/Mkety` remains later and separate.

Every meaningful implementation/testing batch must update this file with what changed, PR/merge state, verification evidence, migrations, account-side actions, and the next safe starting point.
