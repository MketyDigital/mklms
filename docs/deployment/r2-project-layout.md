# R2 layout for multiple MkLMS projects

One Cloudflare account may host many R2 buckets and each bucket may contain many object prefixes. MkLMS does not require one Cloudflare account or one R2 bucket per application.

## Preferred managed-install layout

Use one bucket per managed installation/customer when practical:

```text
mklms-customer-a-media
mklms-customer-b-media
mklms-internal-media
```

Benefits:
- simpler access credentials and lifecycle rules
- simpler customer deletion/export
- clearer usage/accounting boundaries
- reduced risk of one install writing into another install's prefix

## Shared-bucket layout

A shared bucket is also valid when operational simplicity is more important:

```text
shared-media/
  installs/customer-a/media/...
  installs/customer-b/media/...
  projects/marketing-site/...
  certificates/...
```

Use strict prefixes and scoped credentials. Never rely on object names alone for authorization.

## R2 roles

R2 can store HLS video, images, generated certificates, downloadable files, backups/exports and other application objects. Separate buckets/prefixes are an operational choice, not a technical limitation.

R2 stores and serves objects; it does not transcode source video. Transcoding happens before upload (local FFmpeg or a cloud service such as OCI Media Flow), then the finished HLS package is stored once and reused.
