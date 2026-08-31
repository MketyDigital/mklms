# MkLMS production status — 2026-08-31

This file separates repository-proven behavior from account-side production checks that still require operator confirmation.

## Source-control state

- Production branch: `main`.
- Final media/billing/native-R2 integration merged through PR #25.
- Operational handoff documentation merged through PR #26.
- Current final cleanup is PR #27: replace the obsolete OCI Media Flow admin panel with provider-neutral private MP4 multipart upload and automatic DIRECT media registration.
- PR #27 is intentionally scoped: no auth, playback authorization, course, live-class, billing, certificate, messaging, or historical migration changes.

## Database migrations

Repository migrations are `001` through `011`. PR #27 adds no migration and must leave all existing migration files unchanged.

Preferred production operation:

```text
GitHub Actions -> Run MkLMS DB migrations -> select main -> type MIGRATE
```

Require the final `Verify database is current` step to pass. The migration runner is checksum-protected and skips already-applied files.

**Production database application status is account-side until the operator runs/verifies that workflow.**

## Cloudflare runtime

Main `mklms` Worker bindings:
- `ASSETS`
- `HYPERDRIVE_FRESH`
- `HYPERDRIVE_CACHED`
- `APP_STORAGE_BUCKET -> spf-media`

Protected media Worker:
- `MEDIA_BUCKET -> spf-media`
- shared `MKLMS_MEDIA_SIGNING_SECRET`
- GET/HEAD/Range protected private-object delivery

Billing Worker:
- separate `mkety-managed-hosting-billing`
- no DB/R2 binding
- NOWPayments API/IPN secrets plus customer registry

Keep `spf-media` Public Access disabled.

## Current admin media path

PR #27 changes `/admin/media` to the production-aligned flow:

```text
Admin selects MP4
  -> authenticated upload create
  -> 10 MiB multipart chunks
  -> Cloudflare APP_STORAGE_BUCKET native R2
     OR non-Cloudflare S3-compatible adapter
  -> private media/uploads/YYYY/MM/...mp4
  -> automatic media_assets registration
     provider=storage
     source_type=DIRECT
     processing_status=READY
```

The existing manual Register media asset form remains available for objects uploaded through the Cloudflare R2 dashboard/Cyberduck/rclone and for external/custom providers.

The browser never receives R2/S3 credentials or a permanent private object URL. Viewer playback remains through the separate signed media-delivery Worker.

OCI Media Flow -> R2 is legacy/optional. Historical migration 009 and legacy ingest tables/code remain for checksum/backward-compatibility safety but are not required by the active admin media path.

## Paid-course playback

Unchanged. Paid playback requires authenticated student/session, active/completed enrollment, published course/lesson, prerequisite access, READY media, and short-lived playback authorization. Private playback TTL remains bounded by student session lifetime.

## Free live-class playback

Unchanged. Public live rooms require no paid enrollment, but protected playback authorization is issued only while the server-authoritative session state is `LIVE`. Live URL lifetime is capped to the remaining scheduled session duration.

## Authentication

Unchanged. No external auth vendor is required for the current launch:
- admin: built-in access key + signed HTTP-only session;
- student: preauthorization/access credential + hashed lookup + server session + enrollment/access rules.

## Host portability

Cloudflare admin media upload uses native `APP_STORAGE_BUCKET` multipart R2 access. Vercel/OCI/VPS/Node use the existing `MKLMS_STORAGE_*` S3-compatible fallback. Protected media delivery and the main LMS may remain on different providers.

Authoritative references:
- `AGENTS.md`
- `.env.cloudflare.example`
- `docs/deployment/environment-variables.md`
- `docs/deployment/r2-project-layout.md`
- `workers/media-delivery/README.md`
- `workers/billing/README.md`

## Remaining account-side/operator checks

1. Run the DB migration GitHub Action with `MIGRATE`; require final green/current status.
2. Deploy/configure `mklms-media-delivery`; confirm `MEDIA_BUCKET -> spf-media` and shared signing secret.
3. Deploy/configure the billing Worker if automatic hosting billing is wanted.
4. Configure main app values from `.env.cloudflare.example`; confirm both Hyperdrives, `ASSETS`, and `APP_STORAGE_BUCKET -> spf-media`.
5. Redeploy main `mklms`; require Cloudflare production build/deploy green.
6. Test `/admin/media` with one real MP4 upload and confirm automatic DIRECT registration.
7. Also test one MP4 already uploaded through the R2 dashboard using manual registration.
8. Test paid playback Range seeking/refresh/progress.
9. Test free live class before LIVE, during LIVE, and after ENDED.
10. Test certificate private storage/download.
11. Test manual managed-hosting PENDING/PAID/WAIVED and, if enabled, one small real automatic billing settlement.
