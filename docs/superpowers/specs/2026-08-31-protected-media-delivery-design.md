# Protected Media Delivery and Host Environment Design

**Date:** 2026-08-31
**Status:** Proposed for implementation after user review
**Repository:** `MketyDigital/mklms`

## 1. Goal

Add a production media-delivery boundary for private R2-hosted video without weakening the existing course or simulated-live authorization rules. Direct MP4 is the initial preferred delivery format because current Zoom recordings are already H.264 video + AAC audio, modest in size, and compatible with browser playback.

The implementation must also create one authoritative environment/deployment reference covering Cloudflare Workers, Vercel, OCI/VPS/Node, self-hosted PostgreSQL, R2 operator tooling, and optional integrations.

## 2. Existing authorization rules to preserve

### Paid lessons

The existing course playback service remains the source of truth. It must continue to require:

- published course,
- active/completed enrollment,
- published lesson,
- sequential/prerequisite access,
- READY media asset,
- active student session,
- short-lived playback authorization capped to the remaining student session lifetime.

The media-delivery Worker does not duplicate enrollment/course logic.

### Free live classes

The live-class page remains publicly reachable by slug while the batch is ACTIVE, without paid student enrollment.

Playback remains time-gated by the existing live engine:

- UPCOMING/BETWEEN_SESSIONS/ENDED: no playback authorization is issued;
- LIVE: a short-lived authorization is issued for the currently active session;
- authorization is tied to the anonymous live viewer identity and refreshed while the session remains live;
- the browser seeks to the server-authoritative live offset and corrects drift as it already does;
- once the session/batch stops being LIVE, MKLMS stops issuing new playback authorizations.

This preserves the intended simulated-live experience: anyone with the active free-class link may watch while the scheduled session is live, but the same media object is not exposed as a permanent public URL.

## 3. Architecture

Use a separate Cloudflare Worker named conceptually `mklms-media-delivery`.

```text
Paid lesson or active free live class
        ↓
MKLMS authorization endpoint
        ↓
short-lived HMAC-signed delivery URL
        ↓
mklms-media-delivery Worker
        ↓
private R2 binding
        ↓
MP4 bytes / byte ranges
```

The main MKLMS application remains deployable on Cloudflare, Vercel, OCI/VPS, or another Node host. The media-delivery Worker is Cloudflare-specific because it uses a direct private R2 binding.

## 4. Authorization contract

Keep the existing signed URL contract produced by `SignedDeliveryMediaProvider`:

- path: opaque `providerAssetId`, e.g. `media/transformation-program/module-01/lesson-01.mp4`
- `mk_asset`
- `mk_viewer`
- `mk_exp`
- `mk_sig`

Current signature payload remains:

```text
assetId|providerAssetId|viewerId|expiresEpoch
```

using HMAC-SHA256 and `MKLMS_MEDIA_SIGNING_SECRET`.

The media Worker must reconstruct the exact payload and verify the signature with constant-time comparison semantics where practical. It must reject missing, malformed, expired, or tampered authorization.

The signing secret must be identical on the MKLMS app and media-delivery Worker, but stored independently as a secret in each deployment environment.

## 5. Direct MP4 delivery behavior

Initial production focus is `DIRECT` MP4.

The Worker must:

- accept only `GET` and `HEAD`;
- normalize and validate the requested object key;
- reject traversal or malformed paths;
- fetch only through the private R2 binding;
- return `404` without leaking origin details when an object is missing;
- preserve useful object metadata such as `Content-Type`;
- set `Accept-Ranges: bytes`;
- support normal browser `Range` requests and return `206 Partial Content` with correct `Content-Range` and `Content-Length`;
- return `416 Range Not Satisfiable` for invalid ranges;
- support `HEAD` without returning the body;
- avoid exposing R2 S3 hostnames or credentials in headers, body, source maps, or client configuration;
- use restrictive CORS/origin policy appropriate for the configured MKLMS site origin(s);
- avoid public caching of authorization-bearing URLs unless a later reviewed design explicitly allows it.

Correct range handling is required for fast seeking, resume behavior, and simulated-live offset jumps.

## 6. Live-class compatibility

No live-class scheduling logic moves into the media Worker.

The existing live playback flow remains:

```text
public /live/[slug]
  ↓
/api/live/[slug]/state
  ↓
state resolves LIVE
  ↓
POST /api/live/[slug]/playback
  ↓
short-lived signed DIRECT authorization
  ↓
video element loads protected MP4
  ↓
loadedmetadata → seek to authoritative live offset
```

The signed URL TTL remains short (existing live default 180 seconds, clamped by service rules). The browser continues refreshing authorization before expiry while state remains LIVE.

A copied live media URL therefore expires quickly even though the free-class page itself is public during the active session.

## 7. Paid-course compatibility

The existing protected lesson player must continue to:

- request authorization with `cache: no-store`;
- set the returned direct URL as the `<video>` source;
- preserve resume position when authorization refreshes;
- report watch progress against the existing playback grant;
- never receive the R2 origin URL.

No changes to lesson unlocking, progress, certificate, messaging, or enrollment behavior are required for this subsystem.

## 8. Future HLS compatibility

Do not remove HLS support from MKLMS. The media Worker should be structured so HLS support can later be added/reused, but direct MP4 is the initial production scope.

If HLS is enabled later, master playlists, child playlists, and segments must all remain behind equivalent authorization; a protected master manifest pointing to public R2 child objects is not acceptable.

## 9. Worker project layout

Prefer a focused standalone Worker directory in this repository, for example:

```text
workers/media-delivery/
  src/index.ts
  wrangler.jsonc
  package.json (only if needed)
  README.md
```

Avoid coupling its deployment command to the main OpenNext `wrangler.jsonc`.

The Worker Wrangler configuration will declare:

- Worker name,
- compatibility date,
- private R2 bucket binding, e.g. `MEDIA_BUCKET`,
- no embedded secret values.

`MKLMS_MEDIA_SIGNING_SECRET` is set with Cloudflare Worker secrets, not committed.

## 10. Environment/deployment reference

Add one authoritative file, recommended:

```text
docs/deployment/environment-variables.md
```

It will classify every supported setting as:

- required on all normal MKLMS hosts,
- Cloudflare app Worker only,
- media-delivery Worker only,
- Vercel/OCI/VPS/Node only where behavior differs,
- operator/local upload tooling only,
- optional integration.

### Portable application variables

Document at minimum:

```text
DATABASE_URL
DATABASE_SSL
DATABASE_POOL_MAX
MKLMS_ADMIN_ACCESS_KEY
MKLMS_ADMIN_SESSION_SECRET
MKLMS_ADMIN_SESSION_TTL_SECONDS
MKLMS_MEDIA_DELIVERY_BASE_URL
MKLMS_MEDIA_SIGNING_SECRET
MKLMS_STORAGE_BUCKET
MKLMS_STORAGE_REGION
MKLMS_STORAGE_ENDPOINT
MKLMS_STORAGE_ACCESS_KEY_ID
MKLMS_STORAGE_SECRET_ACCESS_KEY
MKLMS_STORAGE_FORCE_PATH_STYLE
MKLMS_EMAIL_PROVIDER
MKLMS_SMTP_HOST
MKLMS_SMTP_PORT
MKLMS_SMTP_SECURE
MKLMS_SMTP_USER
MKLMS_SMTP_PASSWORD
MKLMS_EMAIL_FROM
MKLMS_TELEGRAM_BOT_TOKEN
MKLMS_TELEGRAM_CHAT_ID
MKLMS_OCI_MEDIA_AUTOMATION_ENABLED
MKLMS_OCI_SOURCE_BUCKET
MKLMS_OCI_OUTPUT_BUCKET
MKLMS_OCI_MEDIA_WORKFLOW_ID
MKLMS_R2_MEDIA_BUCKET
MKLMS_MANAGED_HOSTING_ENABLED
MKLMS_MANAGED_HOSTING_MIN_USD
MKLMS_MANAGED_HOSTING_MAX_USD
MKLMS_MANAGED_HOSTING_OPERATOR_KEY
MKLMS_MANAGED_PAYMENT_URL
MKLMS_MANAGED_HOSTING_NOTICE
```

### Cloudflare app Worker bindings

Document as bindings rather than environment variables:

```text
HYPERDRIVE_FRESH
HYPERDRIVE_CACHED
ASSETS
```

### Media-delivery Worker configuration

Document:

```text
MKLMS_MEDIA_SIGNING_SECRET   # secret
MKLMS_MEDIA_ALLOWED_ORIGINS  # optional/required policy setting decided in implementation
MEDIA_BUCKET                 # R2 binding, not a string secret
```

### Local/operator R2 upload variables

Document separately so operators do not accidentally put them in browser/application client settings:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

## 11. Host portability

### Cloudflare Workers

- app runtime prefers Hyperdrive bindings;
- `DATABASE_URL` remains fallback/build/migration-compatible;
- protected video URL points to separate media Worker;
- R2 media Worker uses direct R2 binding.

### Vercel

- uses normal Node PostgreSQL pool via `DATABASE_URL`;
- uses the same `MKLMS_MEDIA_DELIVERY_BASE_URL` and signing secret;
- may use the same Cloudflare media-delivery Worker and R2 bucket.

### OCI/VPS/Node/Docker

- same as Vercel for database/runtime configuration;
- can use Supabase, managed PostgreSQL, or self-hosted PostgreSQL via standard `DATABASE_URL`;
- may still use Cloudflare R2 + the media Worker for protected video.

Self-hosted PostgreSQL must remain a supported drop-in database target as long as it is PostgreSQL-compatible and all MkLMS migrations are applied.

## 12. Security properties

The implementation must guarantee at the application/transport level:

- private R2 bucket;
- no permanent R2 object URL in normal student/live playback responses;
- short-lived signed playback URLs;
- signature covers asset ID, exact object key, viewer identity, and expiry;
- expiry checked by media Worker;
- object key cannot be changed without invalidating signature;
- paid authorization still enforced by MKLMS before signing;
- live authorization still enforced by LIVE state before signing;
- byte ranges do not bypass signature verification;
- HEAD does not bypass signature verification;
- secrets never enter git or client-side bundles.

This is access control, not DRM. A legitimately authorized viewer can still screen-record content.

## 13. Testing strategy

Use TDD before behavior implementation.

Tests must cover at minimum:

- valid signed direct-MP4 request;
- expired signature rejection;
- tampered path rejection;
- tampered asset/viewer/expiry rejection;
- missing signature fields;
- missing R2 object;
- normal full GET;
- HEAD;
- valid start/end/open-ended byte ranges;
- invalid range → 416;
- correct `206`, `Content-Range`, `Content-Length`, `Accept-Ranges`;
- no R2 origin leakage;
- live playback still refuses authorization when not LIVE;
- live DIRECT playback remains supported and refreshable;
- paid lesson playback still requires active enrollment/access and retains session-capped authorization;
- environment documentation/config contract is complete enough to prevent confusing bindings with env vars.

Before merge require:

- full test suite,
- lint,
- Next.js production build,
- OpenNext Cloudflare build,
- main Worker Wrangler packaging dry run,
- separate media Worker Wrangler dry run/type validation.

## 14. Deployment sequence

1. Create private R2 bucket.
2. Run/verify database migrations.
3. Configure portable MKLMS environment variables.
4. Deploy/configure the main MKLMS runtime.
5. Deploy the separate media-delivery Worker with the private R2 binding.
6. Set the same strong `MKLMS_MEDIA_SIGNING_SECRET` on the app and media Worker.
7. Set `MKLMS_MEDIA_DELIVERY_BASE_URL` on the app to the media Worker's `workers.dev` or custom-domain base URL.
8. Upload one direct H.264/AAC MP4 to private R2.
9. Register only its opaque object key as the media asset provider reference.
10. Verify paid-course protected playback, seeking, resume, and expiry refresh.
11. Verify free live-class playback while LIVE, authoritative offset seeking, expiry refresh, and denial before/after the session.
12. Only then bulk-upload the remaining production videos.

## 15. Non-goals

This implementation does not:

- add DRM;
- force HLS conversion;
- replace existing student/admin authentication;
- change course access rules;
- change the live-class scheduler/timeline engine;
- add a new database vendor dependency;
- remove Vercel or OCI portability;
- expose direct R2/S3 URLs to viewers.
