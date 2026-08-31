# Azure VM / Laptop → FFmpeg → Private R2 HLS Runbook

This is the safest manual fallback for urgent launches. It does not call OCI Media Flow and therefore cannot incur OCI transcoding charges.

## 1. Transcode once

On Ubuntu/Azure VM:

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
chmod +x scripts/transcode-hls.sh
./scripts/transcode-hls.sh /path/to/day1.mp4 /tmp/day1-hls
```

The script produces a reusable VOD HLS package:

```text
/tmp/day1-hls/master.m3u8
/tmp/day1-hls/360p/index.m3u8
/tmp/day1-hls/480p/index.m3u8
/tmp/day1-hls/720p/index.m3u8
...segments...
```

Once this package is valid, do not transcode it again unless the source or encoding profile changes.

## 2. Create a private R2 bucket and API token

Create an R2 bucket in Cloudflare. Keep it private. Create an R2 S3 API token with object read/write permission for that bucket and note:

- R2 account ID
- Access key ID
- Secret access key
- Bucket name

The S3-compatible API is normal R2 usage; it is not a separate storage service.

## 3. Upload directly from the VM/laptop to R2

Install AWS CLI v2, then set credentials only in the shell/session or secret manager:

```bash
export R2_ACCOUNT_ID='...'
export R2_ACCESS_KEY_ID='...'
export R2_SECRET_ACCESS_KEY='...'
chmod +x scripts/upload-hls-r2.sh
./scripts/upload-hls-r2.sh /tmp/day1-hls YOUR_BUCKET media/live-class-2026/day1-v1
```

The script uploads manifests with the HLS MIME type, segments with `video/mp2t`, applies immutable cache headers, and verifies the master object exists.

The final MkLMS private playback reference is:

```text
media/live-class-2026/day1-v1/master.m3u8
```

Do not expose the R2 S3 endpoint to attendees. Register the opaque reference in MkLMS Media Library and serve it through the configured protected media-delivery layer.

## 4. Repeat for Day 2 and Day 3

Use versioned prefixes so files are immutable:

```text
media/live-class-2026/day1-v1/
media/live-class-2026/day2-v1/
media/live-class-2026/day3-v1/
```

## 5. Automation later

The automated OCI flow must reach the same final R2 layout. Automation is allowed only after an explicit cost estimate is accepted and the deployment has `MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=true`. If a copy to R2 fails after successful transcoding, retry the copy/verification step; do not submit a new transcode job.
