# MkLMS protected media-delivery Worker

This standalone Cloudflare Worker serves authorized private media from R2 without exposing permanent R2 object URLs. The initial production target is direct H.264/AAC MP4 with HTTP byte-range support for normal browser streaming, seeking, resume, and the MkLMS simulated-live offset jump.

## Security boundary

The main MkLMS application decides whether a viewer is entitled to playback. Paid-course playback is authorized only after student/session/enrollment/lesson checks. Free live-class playback is authorized only while the scheduled public session resolves to `LIVE`.

When authorization succeeds, MkLMS signs a short-lived URL containing `mk_asset`, `mk_viewer`, `mk_exp`, and `mk_sig`. This Worker validates that signature and expiry before it touches R2. It does not contain enrollment or live scheduling logic.

## 1. Create the private R2 bucket

The committed Wrangler file currently expects:

```text
mklms-media
```

Create that exact bucket, or edit only `bucket_name` in `workers/media-delivery/wrangler.jsonc` to match the private bucket you created. The binding name must remain:

```text
MEDIA_BUCKET
```

Do not enable a public R2 bucket URL for course/live media.

With Wrangler you may create/list buckets using:

```bash
npx wrangler r2 bucket create mklms-media
npx wrangler r2 bucket list
```

You may also create the bucket from Cloudflare Dashboard → R2 Object Storage.

## 2. Set the shared signing secret

Generate one strong secret once:

```bash
openssl rand -base64 48
```

Do not commit or send the generated value to anyone.

Set that exact value as `MKLMS_MEDIA_SIGNING_SECRET` in the main MkLMS application's production secret store, and also set the same value on this Worker:

```bash
npx wrangler secret put MKLMS_MEDIA_SIGNING_SECRET --config workers/media-delivery/wrangler.jsonc
```

The two values must match exactly or every protected playback request will fail with 403.

## 3. Optional browser-origin CORS list

HMAC authorization is always required. `MKLMS_MEDIA_ALLOWED_ORIGINS` is only an optional CORS response allowlist.

Example:

```text
https://learn.example.com,https://www.example.com
```

A signed browser media request that omits `Origin` is still allowed. A request with an allowed exact origin receives `Access-Control-Allow-Origin` for that origin. Do not use `*` as an authorization mechanism.

Set it in the media Worker's Variables and Secrets in Cloudflare, or with the appropriate Wrangler environment-variable mechanism.

## 4. Dry-run packaging

From the repository root:

```bash
npx wrangler deploy --dry-run --config workers/media-delivery/wrangler.jsonc
```

This should package the standalone Worker without requiring any media file to exist.

## 5. Deploy

```bash
npx wrangler deploy --config workers/media-delivery/wrangler.jsonc
```

Wrangler returns a deployed `workers.dev` URL unless you have disabled that route or configured a custom route/domain.

It will look conceptually like:

```text
https://mklms-media-delivery.<your-workers-subdomain>.workers.dev
```

A custom domain such as `https://media.example.com` can be attached later without changing the signing protocol.

## 6. Configure the main MkLMS app

Set this on the main application host (Cloudflare, Vercel, OCI/VPS/Node, etc.):

```text
MKLMS_MEDIA_DELIVERY_BASE_URL=https://mklms-media-delivery.<your-workers-subdomain>.workers.dev
```

or your custom media domain.

Also set the same shared secret:

```text
MKLMS_MEDIA_SIGNING_SECRET=<same value configured on media Worker>
```

Never set `MKLMS_MEDIA_DELIVERY_BASE_URL` to an R2 S3 endpoint.

## 7. Upload a direct MP4

For the current Zoom recordings, H.264 video + AAC audio in MP4 is already suitable. No HLS conversion is required for the initial launch.

Using rclone, an example upload is:

```bash
rclone copy \
  "$HOME/Desktop/MKLMS Videos/day-01.mp4" \
  "r2:mklms-media/media/course-01/" \
  --progress
```

MkLMS stores only the opaque provider asset ID:

```text
media/course-01/day-01.mp4
```

Do not store a permanent R2 HTTP URL in the media asset.

## 8. Expected direct-MP4 behavior

The Worker supports:

- `GET`;
- `HEAD`;
- normal full-object playback;
- one HTTP byte range at a time;
- `206 Partial Content` for valid byte ranges;
- `416 Range Not Satisfiable` for invalid ranges;
- `Accept-Ranges: bytes`;
- private/no-store delivery headers.

Every full, ranged, and HEAD request must pass the same HMAC/expiry validation before R2 is read.

## 9. Paid course test

1. Create a READY media asset with source type `DIRECT` and provider asset ID such as `media/course-01/day-01.mp4`.
2. Attach it to a published lesson.
3. Sign in as an enrolled student with access to that lesson.
4. Start playback.
5. Seek forward/back and confirm the browser receives ranged responses successfully.
6. Confirm refreshing short-lived authorization preserves the current playback position.
7. Confirm a non-enrolled/suspended/expired session cannot obtain playback authorization.

## 10. Free live-class test

1. Attach the same or another READY `DIRECT` media asset to a live session.
2. Keep the batch ACTIVE.
3. Before the scheduled start, open `/live/<slug>` and confirm there is a countdown and no playback authorization.
4. During `LIVE`, confirm the viewer can watch without student enrollment.
5. Confirm the player jumps to the current server-authoritative offset rather than starting from zero for a late joiner.
6. Leave the page open long enough for playback authorization to refresh.
7. After the session is no longer LIVE, confirm MKLMS stops issuing new playback authorization.

The free-class page being public does not make the R2 media object public.

## 11. Troubleshooting

**403:** signing secret mismatch, expired URL, malformed/tampered URL, or changed object path.

**404:** signed request is valid but the object key does not exist in the bound private bucket.

**416:** browser/client requested an invalid byte range.

**Video loads but seeking fails:** inspect the response for `206`, `Content-Range`, `Content-Length`, and `Accept-Ranges: bytes`.

**Main app says protected delivery is not configured:** set both `MKLMS_MEDIA_DELIVERY_BASE_URL` and `MKLMS_MEDIA_SIGNING_SECRET` on that app deployment and redeploy.

For the complete host-by-host variable matrix, see `docs/deployment/environment-variables.md`.
