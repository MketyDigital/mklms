# R2 storage layout and Cloudflare bindings

Current production/test bucket: `spf-media`.

Keep **Public Access disabled**. Protected videos and private application objects are served only through trusted application/Worker paths.

## Cloudflare-native bindings

When MkLMS runs on Cloudflare, two logical consumers may bind the same private bucket:

- Main MkLMS Worker: `APP_STORAGE_BUCKET` -> `spf-media`
- Protected media-delivery Worker: `MEDIA_BUCKET` -> `spf-media`

These are runtime bindings, not string environment variables. Workers using these bindings do **not** need R2 Access Key ID or Secret Access Key credentials.

The two consumers remain isolated by application purpose and object-key prefixes even when they use the same physical bucket.

## Suggested prefixes

```text
spf-media/
  media/
    <course-or-program>/
      <lesson>.mp4
  certificates/
    <student-id>/
      <certificate>.pdf
  app/
    <future-private-objects>
```

MkLMS already writes certificates under `certificates/...`. Protected video provider asset IDs should use opaque object keys under `media/...` and never store a public R2 URL.

For a small installation, using one private bucket with disciplined prefixes is simple and inexpensive. For future customers/projects with different retention, legal, access, or lifecycle requirements, create separate buckets rather than relying only on prefixes.

## Non-Cloudflare hosts

Vercel, OCI/VPS, Docker and other Node hosts cannot consume a Cloudflare Worker R2 binding. The existing S3-compatible fallback remains supported with:

```text
MKLMS_STORAGE_BUCKET
MKLMS_STORAGE_REGION
MKLMS_STORAGE_ENDPOINT
MKLMS_STORAGE_ACCESS_KEY_ID
MKLMS_STORAGE_SECRET_ACCESS_KEY
MKLMS_STORAGE_FORCE_PATH_STYLE
```

For Cloudflare-hosted application storage these S3 credentials are optional because `APP_STORAGE_BUCKET` is preferred when present.

## Laptop/operator uploads

A Worker binding does not authenticate software running on a laptop. If using an S3 client such as Cyberduck or rclone, create an R2 Object Read & Write API token scoped to `spf-media` and use the generated Access Key ID / Secret Access Key.

For a few small videos, the Cloudflare dashboard upload UI requires no S3 credentials at all.

## Local Uploads setting

Cloudflare R2 Local Uploads is an optional upload-performance feature. It can remain disabled. When enabled, Cloudflare accepts upload data near the uploader and asynchronously copies it to the bucket's storage location; it does not make the bucket public and does not replace authorization.
