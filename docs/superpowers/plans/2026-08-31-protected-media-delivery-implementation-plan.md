# Protected Media Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production Cloudflare media-delivery Worker for private R2 direct-MP4 playback, preserve paid-course and free-live authorization behavior, and document every deployment/environment requirement for Cloudflare, Vercel, OCI/VPS/Node, self-hosted PostgreSQL, and operator tooling.

**Architecture:** The main MkLMS app remains the sole authorization authority. It issues the existing short-lived HMAC-signed delivery URL after either paid-course authorization or active-live-session authorization. A separate `mklms-media-delivery` Worker validates that signature, reads only from a private R2 binding, supports full and byte-range MP4 responses, and never exposes an R2 S3 URL. The same media Worker may serve MkLMS deployments running on Cloudflare, Vercel, OCI/VPS, or other Node hosts.

**Tech Stack:** Next.js 16.3.3, React 19.2.3, TypeScript, Node 24, Cloudflare Workers/Wrangler 4.127.1, R2, Web Crypto API, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-protected-media-delivery-design.md`

## Global Constraints

- Preserve every existing paid-course enrollment, lesson-unlock, session, progress, certificate, messaging, admin-auth, and live-class scheduling rule.
- Direct MP4 is the initial production media format; do not remove HLS support from the application.
- Free live-class playback is public-by-link only while the server resolves the scheduled session as `LIVE`; no student enrollment is required for that flow.
- Paid lesson playback remains authenticated and enrollment/access controlled before signing.
- The media Worker never decides entitlement; it only validates signed authorization and serves the already-authorized object.
- R2 remains private and no permanent R2 S3/object URL may appear in normal viewer responses.
- `MKLMS_MEDIA_SIGNING_SECRET` must be identical on the application and media Worker but must never be committed.
- Byte-range and HEAD requests must pass the same signature/expiry validation as full GET requests.
- Keep the main OpenNext deployment and Vercel/OCI/Node compatibility intact.
- Self-hosted PostgreSQL remains supported via standard `DATABASE_URL` with MkLMS migrations applied.
- Node runtime baseline remains 24.x.

---

## File Structure

Create or modify these focused units:

- `workers/media-delivery/src/auth.ts` — parse and verify the existing MkLMS HMAC authorization contract using Web Crypto.
- `workers/media-delivery/src/range.ts` — parse a single HTTP byte range and return a normalized range or unsatisfiable result.
- `workers/media-delivery/src/index.ts` — Worker request handling, R2 lookup/range retrieval, response headers, HEAD/GET/CORS behavior.
- `workers/media-delivery/wrangler.jsonc` — standalone media Worker config with `MEDIA_BUCKET` binding placeholder/documentation but no secret values.
- `workers/media-delivery/README.md` — exact deployment, R2 binding, secret, URL, and testing instructions.
- `tests/media-delivery-worker.test.mjs` — executable unit tests for auth/range/response behavior.
- `tests/protected-media-delivery-contract.test.mjs` — extend application-side contract checks so DIRECT playback and no-origin-leak guarantees remain locked.
- `tests/live-class-playback.test.mjs` or the existing live playback test file discovered during implementation — add regression cases for not-LIVE denial and LIVE DIRECT authorization refresh contract without changing behavior.
- `docs/deployment/environment-variables.md` — authoritative environment/binding matrix for all supported hosts.
- `.env.example` — align comments/names with the authoritative environment reference without adding secrets.
- `docs/deployment/cloudflare-build-settings.md` — correct stale one-binding wording and point to the environment reference.
- `docs/deployment/r2-project-layout.md` — update primary direct-MP4 guidance while retaining HLS future guidance.
- `docs/deployment/production-status-2026-08-31.md` — record what this implementation proves and what still requires account-side deployment verification.

---

### Task 1: Lock the signed authorization and range contracts with failing tests

**Files:**
- Create: `tests/media-delivery-worker.test.mjs`
- Test existing: `src/providers/signed-delivery-media-provider.ts`

**Interfaces:**
- Consumes existing signature payload: `assetId|providerAssetId|viewerId|expiresEpoch`.
- Produces required Worker exports for testability: `verifyPlaybackAuthorization(input, secret, nowEpochSeconds)` and `parseByteRange(rangeHeader, size)`.

- [ ] **Step 1: Write failing authorization tests**

Cover:

```js
await verifyPlaybackAuthorization({
  assetId: "asset-1",
  objectKey: "media/course/lesson.mp4",
  viewer: "viewer-1",
  expiresEpoch: now + 180,
  signature,
}, secret, now)
```

Assertions:
- valid signature returns `{ ok: true }`;
- expired signature returns `{ ok: false, reason: "EXPIRED" }`;
- changed object key, asset, viewer, expiry, or signature returns invalid;
- missing/malformed fields return invalid;
- path traversal such as `../secret` or an absolute path is rejected before R2 access.

- [ ] **Step 2: Write failing range tests**

Cases:

```text
bytes=0-99 on size 1000      -> start 0, end 99, length 100
bytes=900- on size 1000      -> start 900, end 999, length 100
bytes=-100 on size 1000      -> start 900, end 999, length 100
bytes=1000-1200              -> unsatisfiable
bytes=100-50                 -> unsatisfiable
multiple ranges              -> unsupported/unsatisfiable
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
node --experimental-strip-types --test tests/media-delivery-worker.test.mjs
```

Expected: FAIL because Worker auth/range modules do not exist yet.

- [ ] **Step 4: Commit only the failing tests**

```bash
git add tests/media-delivery-worker.test.mjs
git commit -m "test: define protected media worker contract"
```

---

### Task 2: Implement portable HMAC verification and path validation

**Files:**
- Create: `workers/media-delivery/src/auth.ts`
- Test: `tests/media-delivery-worker.test.mjs`

**Interfaces:**
- Produces:

```ts
export interface PlaybackAuthInput {
  assetId: string;
  objectKey: string;
  viewer: string;
  expiresEpoch: number;
  signature: string;
}

export function normalizeObjectKey(pathname: string): string | null;
export async function verifyPlaybackAuthorization(
  input: PlaybackAuthInput,
  secret: string,
  nowEpochSeconds?: number,
): Promise<{ ok: true } | { ok: false; reason: string }>;
```

- [ ] **Step 1: Implement `normalizeObjectKey`**

Rules:
- decode URL path segments once;
- trim only the leading `/` used by URL routing;
- reject empty object keys;
- reject NUL bytes, `.` or `..` path segments, backslashes, and absolute/URL-like values;
- preserve valid spaces/unicode after URL decoding as normal R2 key characters.

- [ ] **Step 2: Implement HMAC verification with Web Crypto**

Use:

```ts
const payload = [assetId, objectKey, viewer, expiresEpoch].join("|");
```

Import HMAC SHA-256 key with `crypto.subtle.importKey`, sign the payload, convert to base64url without padding, and compare expected/provided signature without early per-character exits.

Reject expiry when `expiresEpoch <= nowEpochSeconds`.

- [ ] **Step 3: Run focused tests and verify GREEN for auth cases**

```bash
node --experimental-strip-types --test tests/media-delivery-worker.test.mjs
```

- [ ] **Step 4: Commit**

```bash
git add workers/media-delivery/src/auth.ts tests/media-delivery-worker.test.mjs
git commit -m "feat: verify protected media authorization"
```

---

### Task 3: Implement strict single-range parsing

**Files:**
- Create: `workers/media-delivery/src/range.ts`
- Test: `tests/media-delivery-worker.test.mjs`

**Interfaces:**
- Produces:

```ts
export type ParsedByteRange =
  | { ok: true; start: number; end: number; length: number }
  | { ok: false };

export function parseByteRange(header: string | null, size: number): ParsedByteRange | null;
```

`null` means no Range header and therefore full-body GET/HEAD.

- [ ] **Step 1: Implement regular, open-ended and suffix byte ranges**

Reject non-`bytes=` units, malformed numbers, zero/negative object sizes, multi-range requests, starts beyond object end, and reversed ranges.

Clamp an oversized valid end to `size - 1`.

- [ ] **Step 2: Run focused tests and verify all range cases pass**

```bash
node --experimental-strip-types --test tests/media-delivery-worker.test.mjs
```

- [ ] **Step 3: Commit**

```bash
git add workers/media-delivery/src/range.ts tests/media-delivery-worker.test.mjs
git commit -m "feat: parse media byte ranges"
```

---

### Task 4: Build the standalone R2 media-delivery Worker

**Files:**
- Create: `workers/media-delivery/src/index.ts`
- Create: `workers/media-delivery/wrangler.jsonc`
- Modify: `tests/media-delivery-worker.test.mjs`

**Interfaces:**
- Environment:

```ts
interface Env {
  MEDIA_BUCKET: R2Bucket;
  MKLMS_MEDIA_SIGNING_SECRET: string;
  MKLMS_MEDIA_ALLOWED_ORIGINS?: string;
}
```

- Worker default export:

```ts
export default {
  fetch(request: Request, env: Env): Promise<Response>
}
```

- [ ] **Step 1: Add failing Worker response tests with an in-memory R2 stub**

Test:
- valid full GET returns `200`, object bytes, `Accept-Ranges: bytes`, correct type/length;
- HEAD returns headers only;
- `Range: bytes=10-19` returns `206`, correct body, `Content-Range`, `Content-Length`;
- invalid range returns `416` and `Content-Range: bytes */<size>`;
- object missing returns `404` without object key/origin details;
- POST returns `405` with `Allow: GET, HEAD`;
- every GET/HEAD, including Range and HEAD, rejects expired/tampered authorization;
- response never contains `r2.cloudflarestorage.com`.

- [ ] **Step 2: Implement request parsing and mandatory authorization**

Read query parameters:

```text
mk_asset
mk_viewer
mk_exp
mk_sig
```

Use the normalized pathname as `providerAssetId/objectKey`, reconstruct the exact existing payload, and verify before any `MEDIA_BUCKET.head/get` call.

- [ ] **Step 3: Implement R2 full and range reads**

Use `MEDIA_BUCKET.head(key)` to obtain size/metadata before range validation. For a valid range call R2 with:

```ts
MEDIA_BUCKET.get(key, { range: { offset: start, length } })
```

For full GET call `MEDIA_BUCKET.get(key)`.

- [ ] **Step 4: Implement safe response headers**

Set:

```text
Accept-Ranges: bytes
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
Content-Disposition: inline
```

Set `Content-Type` from R2 HTTP metadata when available, otherwise `video/mp4` for `.mp4`, otherwise `application/octet-stream`.

For `206` add exact `Content-Range` and range `Content-Length`.

- [ ] **Step 5: Implement optional exact-origin CORS**

Parse `MKLMS_MEDIA_ALLOWED_ORIGINS` as comma-separated exact origins. If a request contains `Origin` and it exactly matches, emit `Access-Control-Allow-Origin: <origin>` and `Vary: Origin`. If `Origin` is absent, do not reject an otherwise valid signed request. If `Origin` is present but not allowed, do not emit CORS permission; HMAC validation remains mandatory either way.

- [ ] **Step 6: Run focused Worker tests**

```bash
node --experimental-strip-types --test tests/media-delivery-worker.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Add standalone Wrangler config**

Use strict JSON-compatible `wrangler.jsonc`:

```json
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "mklms-media-delivery",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-30",
  "observability": { "enabled": true },
  "r2_buckets": [
    {
      "binding": "MEDIA_BUCKET",
      "bucket_name": "mklms-media"
    }
  ]
}
```

If the actual operator bucket name differs, docs must instruct changing only `bucket_name` before deployment; no credentials belong here.

- [ ] **Step 8: Commit**

```bash
git add workers/media-delivery tests/media-delivery-worker.test.mjs
git commit -m "feat: add private R2 media delivery worker"
```

---

### Task 5: Lock application compatibility for paid lessons and free live classes

**Files:**
- Modify: `tests/protected-media-delivery-contract.test.mjs`
- Modify/create the existing live playback service test discovered in repo tests.
- Read-only behavior targets: `src/features/media/services/media-playback.service.ts`, `src/features/live-classes/services/live-playback.service.ts`, `src/features/live-classes/components/live-class-room-mobile-first.tsx`.

**Interfaces:**
- No production behavior change expected unless tests expose a defect.
- Paid authorization remains student/enrollment/session based.
- Live authorization remains anonymous-viewer + active `LIVE` state based.

- [ ] **Step 1: Add regression assertions for DIRECT paid playback**

Assert:
- signed provider returns `playbackType: "DIRECT"` for direct MP4 assets;
- course service still refuses inactive enrollment and session-expired playback;
- signed URL expiry remains capped to student session expiry.

- [ ] **Step 2: Add live service regression cases**

Assert:
- UPCOMING, BETWEEN_SESSIONS, and ENDED return `NOT_LIVE` with no authorization;
- LIVE with READY DIRECT asset invokes the media provider with viewer ID and returns current server-derived offset;
- no student/course/lesson identity is required for live authorization;
- live TTL remains short (default 180 seconds, service clamp 30–900).

- [ ] **Step 3: Add client contract assertions**

Assert the live room:
- requests `/playback` only when room state is `LIVE`;
- refreshes authorization before expiry;
- assigns DIRECT URL to `<video>`;
- seeks to current authoritative live offset on metadata load.

- [ ] **Step 4: Run focused tests**

```bash
npm test -- --test-name-pattern="media|playback|live"
```

If Node's runner filtering does not match repository script behavior, run the exact relevant test files directly with `node --experimental-strip-types --test`.

- [ ] **Step 5: Commit**

```bash
git add tests
git commit -m "test: preserve course and live protected playback"
```

---

### Task 6: Create the authoritative environment and host-deployment reference

**Files:**
- Create: `docs/deployment/environment-variables.md`
- Modify: `.env.example`
- Modify: `docs/deployment/cloudflare-build-settings.md`
- Modify: `docs/deployment/r2-project-layout.md`
- Create/Modify: `workers/media-delivery/README.md`

**Interfaces:**
- Documentation must distinguish values from Cloudflare bindings and operator-only credentials.

- [ ] **Step 1: Inventory actual environment reads from source**

Search source/scripts for:

```text
process.env.
```

and reconcile every MkLMS environment key against `.env.example` and the approved design. Do not document invented variables as required.

- [ ] **Step 2: Write the portable application matrix**

Create sections:

```text
Required on every normal MkLMS host
Recommended production settings
Cloudflare app Worker bindings (not env vars)
Media-delivery Worker config
Vercel
OCI/VPS/Docker/Node
Self-hosted PostgreSQL
R2/operator/rclone credentials
Optional SMTP
Optional Telegram
Optional OCI media automation
Optional managed hosting
Build-time vs runtime
```

For each variable state: purpose, required/optional, secret/plain, example shape, and which hosts need it.

- [ ] **Step 3: Document authentication production readiness**

State explicitly:
- no external auth service is required for launch;
- admin auth uses `MKLMS_ADMIN_ACCESS_KEY` + signed HTTP-only secure session cookie using `MKLMS_ADMIN_SESSION_SECRET`;
- student access uses built-in preauthorization/access-code/session records and does not depend on Supabase Auth;
- external auth providers are optional future adapters;
- current built-in admin limitations: no MFA/SSO/Google login/password-reset workflow/multiple named admin identities;
- production launch requires strong independent admin access/session secrets and HTTPS.

- [ ] **Step 4: Correct Cloudflare build documentation**

Document exactly:

```text
Node: 24.x
Root: /
Build: npm run cf:build
Deploy: npx opennextjs-cloudflare deploy
```

Replace stale `HYPERDRIVE`-only wording with `HYPERDRIVE_FRESH` / `HYPERDRIVE_CACHED` and point readers to `environment-variables.md`.

- [ ] **Step 5: Update R2/media docs for direct MP4 first**

Make direct MP4 the recommended initial path for the current H.264/AAC Zoom recordings while retaining the HLS section as a future adaptive-streaming option.

- [ ] **Step 6: Write media Worker operator README**

Include exact commands:

```bash
npx wrangler secret put MKLMS_MEDIA_SIGNING_SECRET --config workers/media-delivery/wrangler.jsonc
npx wrangler deploy --config workers/media-delivery/wrangler.jsonc
```

Explain how to change `bucket_name`, optional allowed origins, capture the resulting `workers.dev` URL, and set that URL as `MKLMS_MEDIA_DELIVERY_BASE_URL` in the main app.

- [ ] **Step 7: Add a documentation/config contract test**

Extend or create a Node test that verifies key headings/variable names/binding distinctions exist and that no example contains an actual R2 secret or direct student-facing R2 playback URL.

- [ ] **Step 8: Run documentation contract tests and commit**

```bash
npm test
```

```bash
git add .env.example docs workers/media-delivery/README.md tests
git commit -m "docs: define production environment and media deployment"
```

---

### Task 7: Verify standalone media Worker packaging and main application builds

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run full tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run normal Next.js production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run Cloudflare OpenNext build**

```bash
npm run cf:build
```

Expected: PASS.

- [ ] **Step 5: Dry-run main Worker packaging**

Use the repository's established Wrangler dry-run command from CI and verify compressed Worker size remains under the applicable account limit.

- [ ] **Step 6: Dry-run standalone media Worker**

Run:

```bash
npx wrangler deploy --dry-run --config workers/media-delivery/wrangler.jsonc
```

Expected: Worker validates/packages without needing the signing secret at build time.

- [ ] **Step 7: Record verification evidence**

Update `docs/deployment/production-status-2026-08-31.md` with exact pass/fail results, and explicitly mark account-side media Worker deployment/R2 binding/live-object testing as pending until actually performed.

- [ ] **Step 8: Commit any verification documentation**

```bash
git add docs/deployment/production-status-2026-08-31.md
git commit -m "docs: record protected media verification status"
```

---

### Task 8: Review, PR, and merge only verified changes

**Files:**
- No code changes unless review finds an issue.

- [ ] **Step 1: Review branch diff against the approved spec**

Verify no unrelated feature removal/refactor, no R2/password/signing secret committed, and no existing route behavior changed beyond necessary compatibility fixes.

- [ ] **Step 2: Run final verification again after any review fix**

Required final evidence:

```text
full tests PASS
lint PASS
Next build PASS
OpenNext build PASS
main Wrangler dry-run PASS
media Worker Wrangler dry-run PASS
```

- [ ] **Step 3: Open a PR to `main`**

PR title:

```text
feat: add protected R2 media delivery worker
```

PR body must summarize:
- direct MP4/private R2 delivery;
- paid vs free-live authorization preservation;
- range support;
- env/host documentation;
- verification results;
- account-side steps still required.

- [ ] **Step 4: Inspect GitHub CI/checks**

Do not merge on failing checks. Read and repair failures first.

- [ ] **Step 5: Merge only the verified head**

Use the exact reviewed/tested head SHA and confirm `main` afterward.

- [ ] **Step 6: Give the operator the production activation checklist**

The final user checklist must be ordered:

```text
create private R2 bucket
run/confirm migrations
set app env vars
set Hyperdrive bindings
set media Worker R2 binding
set shared signing secret on app + media Worker
deploy media Worker
set app delivery base URL
deploy/redeploy app
upload one original H.264/AAC MP4 via rclone
register DIRECT media asset using opaque R2 key
test paid playback + seeking + refresh
test free live playback during LIVE + denial outside LIVE
then upload remaining videos
```
