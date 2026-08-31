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

## Private HLS rule

Course-video buckets must remain private. Store an opaque path in MkLMS, for example:

```text
media/course-01-lesson-01/master.m3u8
```

Do not store or return the R2 S3 endpoint as the student's playback URL.

MkLMS course playback first verifies the current session, enrollment, course, lesson and progression rules. It then returns a short-lived signed URL rooted at `MKLMS_MEDIA_DELIVERY_BASE_URL`.

The delivery service behind that base URL is part of the security boundary. For HLS it must protect the **whole object graph**, not only the master playlist:

```text
signed MkLMS delivery URL
        ↓
master.m3u8
        ↓
360p/index.m3u8 / 480p/index.m3u8 / 720p/index.m3u8
        ↓
seg_000001.ts, seg_000002.ts, ...
        ↓
private R2 objects
```

The delivery service must validate the MkLMS signature/expiry before access and either proxy/rewrite manifest references or issue equally protected child URLs. A signed `master.m3u8` that contains permanent public R2 child URLs is **not** considered protected delivery.

The permanent hostname below is operator/server configuration only and must not appear in student playback responses:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

A viewer can necessarily see the short-lived URL their browser is currently playing. The goal is to keep that URL temporary and MkLMS-controlled while never revealing a reusable R2 origin/object URL.
