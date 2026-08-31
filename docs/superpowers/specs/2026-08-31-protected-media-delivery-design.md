# Protected Media Delivery and Host Environment Design

**Date:** 2026-08-31
**Status:** Approved and implemented on feature branch pending final merge verification
**Repository:** `MketyDigital/mklms`

## 1. Goal

Add a production media-delivery boundary for private R2-hosted video without weakening the existing course or simulated-live authorization rules. Direct MP4 is the initial preferred delivery format because current Zoom recordings are already H.264 video + AAC audio, modest in size, and compatible with browser playback.

The implementation also creates one authoritative environment/deployment reference covering Cloudflare Workers, Vercel, OCI/VPS/Node, self-hosted PostgreSQL, R2 operator tooling, authentication and optional integrations.

## 2. Authorization rules preserved

### Paid lessons

The existing course playback service remains the source of truth and requires:

- published course;
- active/completed enrollment;
- published lesson;
- sequential/prerequisite access;
- READY media asset;
- active student session;
- short-lived playback authorization capped to the remaining student session lifetime.

The media-delivery Worker does not duplicate enrollment/course logic.

### Free live classes

The live-class page remains publicly reachable by slug while the batch is ACTIVE, without paid student enrollment.

Playback remains time-gated by the existing live engine:

- UPCOMING/BETWEEN_SESSIONS/ENDED: no playback authorization is issued;
- LIVE: short-lived authorization is issued for the currently active session;
- authorization is tied to the anonymous live viewer identity and refreshed while the session remains live;
- the effective authorization TTL is the smaller of the normal live TTL and the number of whole seconds remaining in the scheduled session;
- the browser seeks to the server-authoritative live offset and corrects drift as it already does;
- once the session/batch stops being LIVE, MKLMS stops issuing new playback authorizations.

This preserves the simulated-live experience: anyone with the active free-class link may watch while the scheduled session is live, but the same media object is never exposed as a permanent public URL and an authorization created near session end cannot retain the normal multi-minute TTL beyond that scheduled end.

## 3. Architecture

Use a separate Cloudflare Worker named `mklms-media-delivery`.

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

The main MkLMS application remains deployable on Cloudflare, Vercel, OCI/VPS, or another Node host. The media-delivery Worker is Cloudflare-specific because it uses a direct private R2 binding.

## 4. Authorization contract

Keep the existing signed URL contract produced by `SignedDeliveryMediaProvider`:

- path: opaque `providerAssetId`, e.g. `media/transformation-program/module-01/lesson-01.mp4`;
- `mk_asset`;
- `mk_viewer`;
- `mk_exp`;
- `mk_sig`.

Current signature payload remains:

```text
assetId|providerAssetId|viewerId|expiresEpoch
```

using HMAC-SHA256 and `MKLMS_MEDIA_SIGNING_SECRET`.

The media Worker reconstructs the exact payload and verifies the signature before touching R2. Missing, malformed, expired or tampered authorization is rejected.

The signing secret is identical on the MkLMS app and media-delivery Worker but stored independently as a secret in each deployment environment.

## 5. Direct MP4 delivery behavior

Initial production focus is `DIRECT` MP4.

The Worker:

- accepts only `GET` and `HEAD`;
- normalizes and validates the requested object key;
- rejects traversal or malformed paths;
- fetches only through the private R2 binding;
- returns generic `404` without leaking origin details when an object is missing;
- preserves useful object metadata such as `Content-Type`;
- sets `Accept-Ranges: bytes`;
- supports normal single browser `Range` requests and returns `206 Partial Content` with correct `Content-Range` and `Content-Length`;
- returns `416 Range Not Satisfiable` for invalid ranges;
- supports `HEAD` without returning the body;
- avoids exposing R2 S3 hostnames or credentials in normal viewer responses;
- uses `private, no-store` for authorization-bearing delivery responses;
- verifies HMAC authorization for every full, ranged and HEAD request.

Correct range handling enables fast seeking, resume behavior and simulated-live offset jumps.

### Origin and CORS policy

`MKLMS_MEDIA_ALLOWED_ORIGINS` is an optional comma-separated exact-origin allowlist used only to control CORS response headers. When an `Origin` header is present and matches the allowlist, the Worker may echo that exact origin in `Access-Control-Allow-Origin`; it never emits `*` for protected media. Requests that omit `Origin` are still allowed when the HMAC is valid because browser media fetches may legitimately omit it. Origin is defense-in-depth and never replaces signature verification.

## 6. Live-class compatibility

No scheduling logic moves into the media Worker.

The live playback flow remains:

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

The configured live TTL remains short (default 180 seconds, constructor clamp 30–900 seconds), but the **effective** TTL is additionally capped to the remaining scheduled session duration. The browser continues refreshing authorization before expiry while state remains LIVE.

A copied live media URL therefore expires quickly and cannot retain a normal 180-second lifetime when fewer seconds remain in the scheduled class.

## 7. Paid-course compatibility

The existing protected lesson player continues to:

- request authorization with `cache: no-store`;
- set the returned direct URL as the `<video>` source;
- preserve resume position when authorization refreshes;
- report watch progress against the existing playback grant;
- never receive the R2 origin URL.

No changes to lesson unlocking, progress, certificate, messaging or enrollment behavior are required for this subsystem.

## 8. Future HLS compatibility

HLS support remains in MkLMS. Direct MP4 is the initial production scope because it better matches the current video library and operational simplicity requirement.

If HLS is enabled later, master playlists, child playlists and segments must all remain behind equivalent authorization; a protected master manifest pointing to public R2 child objects is not acceptable.

## 9. Worker project layout

```text
workers/media-delivery/
  src/auth.ts
  src/range.ts
  src/index.ts
  wrangler.jsonc
  README.md
```

The media Worker deployment remains independent from the main OpenNext `wrangler.jsonc`.

Its configuration declares:

- Worker name `mklms-media-delivery`;
- compatibility date;
- private R2 bucket binding `MEDIA_BUCKET`;
- no embedded secret values.

`MKLMS_MEDIA_SIGNING_SECRET` is stored as a Cloudflare Worker secret, not committed.

## 10. Environment/deployment reference

`docs/deployment/environment-variables.md` is the authoritative reference. It classifies configuration as:

- portable application variables;
- Cloudflare main-Worker bindings;
- media-delivery Worker configuration;
- Vercel differences;
- OCI/VPS/Docker/Node differences;
- self-hosted PostgreSQL;
- operator/local R2 upload credentials;
- optional SMTP, Telegram, OCI media automation and managed-hosting integrations.

It also documents the built-in admin and student authentication model and the optional student access-code/session fallback variables.

## 11. Host portability

### Cloudflare Workers

- app runtime prefers `HYPERDRIVE_FRESH` for consistency-sensitive database work;
- `HYPERDRIVE_CACHED` is opt-in for safe stable public reads;
- `DATABASE_URL` remains fallback/build/migration-compatible;
- protected video points to the separate media Worker;
- media Worker uses direct private R2 binding.

### Vercel

- uses normal Node PostgreSQL pool via `DATABASE_URL`;
- uses the same `MKLMS_MEDIA_DELIVERY_BASE_URL` and signing secret;
- can use the same Cloudflare media-delivery Worker and R2 bucket.

### OCI/VPS/Node/Docker

- same portable runtime variables as Vercel;
- can use Supabase, managed PostgreSQL or self-hosted PostgreSQL through standard `DATABASE_URL`;
- may still use Cloudflare R2 plus the media Worker for protected video.

Self-hosted PostgreSQL remains supported when it is PostgreSQL-compatible, securely reachable and all MkLMS migrations are applied.

## 12. Authentication position

No external authentication vendor is required for the current production architecture.

- Admin authentication uses the built-in access-key verification and signed HTTP-only production session cookie.
- Student authentication uses built-in preauthorization/access-code credentials, hashed credential storage, server sessions, enrollment and course-access checks.

External auth providers can be added later as adapters. Current built-in admin limitations include no MFA, SSO/Google login, password-reset email workflow or multiple named admin identities.

## 13. Security properties

The implementation requires:

- private R2 bucket;
- no permanent R2 object URL in normal student/live playback responses;
- short-lived signed playback URLs;
- signature covering asset ID, exact object key, viewer identity and expiry;
- expiry checked by media Worker;
- object key changes invalidate authorization;
- paid authorization enforced by MkLMS before signing;
- live authorization enforced by LIVE state before signing;
- live authorization TTL capped by scheduled session end;
- byte ranges cannot bypass signature verification;
- HEAD cannot bypass signature verification;
- secrets never enter git or client-side bundles.

This is access control, not DRM. A legitimately authorized viewer can still screen-record content.

## 14. Testing and verification

TDD covers:

- valid signed direct-MP4 request;
- expired/tampered authorization;
- malformed/traversal object paths;
- missing object;
- full GET;
- HEAD;
- bounded/open-ended/suffix byte ranges;
- invalid range → 416;
- `206`, `Content-Range`, `Content-Length`, `Accept-Ranges`;
- no R2 origin leakage;
- deployment/binding/env documentation contract;
- live denial when not LIVE;
- live viewer-scoped authorization/current offset;
- live effective TTL capped to scheduled session end;
- existing paid lesson enrollment/session restrictions.

Before merge require fresh evidence for:

- full tests;
- lint;
- Next.js production build;
- OpenNext Cloudflare build;
- main Worker Wrangler dry-run;
- separate media Worker Wrangler dry-run.

## 15. Deployment sequence

1. Create private R2 bucket.
2. Run/verify database migrations.
3. Configure portable MkLMS environment variables.
4. Configure/deploy the main MkLMS runtime.
5. Deploy the separate media-delivery Worker with the private R2 binding.
6. Set the same strong `MKLMS_MEDIA_SIGNING_SECRET` on the app and media Worker.
7. Set `MKLMS_MEDIA_DELIVERY_BASE_URL` on the app to the media Worker's `workers.dev` or custom-domain base URL.
8. Upload one direct H.264/AAC MP4 to private R2.
9. Register only its opaque object key as the media asset provider reference with source type `DIRECT`.
10. Verify paid-course protected playback, seeking, resume and expiry refresh.
11. Verify free live-class playback while LIVE, authoritative offset seeking, expiry refresh and denial before/after the session.
12. Only then bulk-upload the remaining production videos.

## 16. Non-goals

This implementation does not:

- add DRM;
- force HLS conversion;
- replace existing student/admin authentication;
- change course access rules;
- replace the live-class scheduler/timeline engine;
- add a new database vendor dependency;
- remove Vercel or OCI portability;
- expose direct R2/S3 URLs to viewers.
