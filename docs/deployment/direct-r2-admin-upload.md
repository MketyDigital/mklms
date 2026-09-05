# Direct R2 admin MP4 upload

MkLMS admin media upload uses a browser-direct R2 flow so large MP4 bodies do not pass through the main OpenNext/Cloudflare Worker.

## Production bucket

For the current installation the private bucket is:

```text
spf-media
```

The main Worker `APP_STORAGE_BUCKET` and the media-delivery Worker `MEDIA_BUCKET` already point at that private bucket. Keep R2 Public Access disabled.

Direct browser upload additionally needs the main application to create short-lived S3-compatible presigned PUT URLs. A native R2 Worker binding can read/write objects but cannot itself provide an S3 presigned URL to a browser, so the main Worker needs a bucket-scoped R2 S3 token for this one authorization job.

## Main Worker configuration

Preferred explicit settings:

```text
MKLMS_R2_DIRECT_UPLOAD_BUCKET=spf-media
MKLMS_R2_DIRECT_UPLOAD_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
MKLMS_R2_DIRECT_UPLOAD_ACCESS_KEY_ID=<R2 token access key>
MKLMS_R2_DIRECT_UPLOAD_SECRET_ACCESS_KEY=<R2 token secret>
```

Store the access key and secret as Cloudflare Worker secrets. The bucket and endpoint may be normal variables.

For compatibility, MkLMS can also derive these values from the existing R2/S3 variables:

```text
MKLMS_R2_MEDIA_BUCKET=spf-media
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<R2 token access key>
R2_SECRET_ACCESS_KEY=<R2 token secret>
```

or the portable `MKLMS_STORAGE_*` S3-compatible settings. Prefer a token scoped only to the required bucket and only the object read/write permissions needed for upload verification.

The browser never receives either credential. It receives only a short-lived URL for a server-generated object key matching:

```text
media/<uuid>.mp4
```

The browser cannot choose the bucket or an arbitrary object prefix. After the PUT completes, the server HEAD-checks the exact object before registering it as an existing private `DIRECT` media asset.

## R2 CORS

Because the browser sends the PUT directly to R2, configure CORS on `spf-media` for the production LMS origin. A minimal policy is conceptually:

```json
[
  {
    "AllowedOrigins": ["https://YOUR_LMS_DOMAIN"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Use the real HTTPS LMS origin. Add preview origins only when deliberately testing previews; do not use `*` for production when an exact origin is known.

Server-side finalization performs the object HEAD request, so the browser does not need public GET/HEAD access.

## Production smoke test

1. Confirm `APP_STORAGE_BUCKET` still points to `spf-media`.
2. Confirm `mklms-media-delivery` still has `MEDIA_BUCKET` pointing to `spf-media`.
3. Configure the direct-upload bucket/endpoint and scoped credentials on the main `mklms` Worker.
4. Apply R2 CORS for the LMS origin.
5. Keep bucket Public Access disabled.
6. Admin -> Media: upload a normal MP4.
7. Confirm the object appears under `media/` in `spf-media` and the UI reports it registered.
8. Assign the resulting media asset to a paid course lesson and verify protected playback/range seeking.
9. Assign the same media asset to a paid-course live session and verify only an enrolled student receives playback while the session is `LIVE`.
10. Confirm the existing public/free `/live/[slug]` webinar flow still works independently.

## Size behavior

The current browser-direct path uses a single presigned S3 PUT and rejects files over 5 GB. This removes the Cloudflare application request-body/memory bottleneck for ordinary course MP4s while failing clearly instead of silently proxying oversized media through the LMS Worker.
