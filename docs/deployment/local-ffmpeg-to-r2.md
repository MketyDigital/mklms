# Free local transcoding to R2

Use this path when you do not want to pay a cloud transcoder. It produces the same final architecture as OCI Media Flow: HLS is created once, uploaded to R2, then reused by MkLMS.

## Requirements

- Windows, macOS, or Linux computer with enough free disk space.
- FFmpeg installed.
- rclone configured for Cloudflare R2, or another S3-compatible R2 upload tool.
- Keep the source video and generated HLS local until R2 playback is verified.

## Recommended outputs

For class/tutorial video, start with three H.264 renditions:

- 480p around 1.0–1.5 Mbps
- 720p around 2.5–3.5 Mbps
- 1080p around 4.5–6 Mbps
- AAC audio around 128 kbps
- 6-second HLS segments

Do not upscale a source that is lower resolution than an output rung.

## Example FFmpeg command

Run from a working directory and replace `input.mp4`.

```bash
mkdir -p hls/v0 hls/v1 hls/v2

ffmpeg -i input.mp4 \
  -filter_complex "[0:v]split=3[v0][v1][v2];[v0]scale=-2:480[v0out];[v1]scale=-2:720[v1out];[v2]scale=-2:1080[v2out]" \
  -map "[v0out]" -map 0:a:0 -c:v:0 libx264 -b:v:0 1200k -maxrate:v:0 1320k -bufsize:v:0 2400k \
  -map "[v1out]" -map 0:a:0 -c:v:1 libx264 -b:v:1 3000k -maxrate:v:1 3300k -bufsize:v:1 6000k \
  -map "[v2out]" -map 0:a:0 -c:v:2 libx264 -b:v:2 5500k -maxrate:v:2 6050k -bufsize:v:2 11000k \
  -c:a aac -b:a 128k -ar 48000 \
  -preset medium -g 180 -keyint_min 180 -sc_threshold 0 \
  -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename "hls/v%v/segment_%05d.ts" \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0,name:480p v:1,a:1,name:720p v:2,a:2,name:1080p" \
  "hls/v%v/index.m3u8"
```

If your FFmpeg build/source audio mapping differs, test a short clip first. Hardware encoders such as Apple VideoToolbox, NVIDIA NVENC, or Intel Quick Sync can reduce processing time, but software `libx264` is the most portable reference path.

## Verify locally

Before upload:

1. Confirm `hls/master.m3u8` exists.
2. Confirm each rendition playlist exists.
3. Confirm segment files exist.
4. Play `master.m3u8` in an HLS-capable player or local test page.
5. Scrub through the full duration and confirm audio/video synchronization.

## Upload the completed HLS folder to R2

With an rclone remote named `r2`:

```bash
rclone copy hls r2:YOUR_BUCKET/media/YOUR_ASSET_ID/ --progress --transfers 16 --checkers 32
```

Then verify the R2 prefix contains `master.m3u8`, all child playlists, and all segments. Do not upload only the master playlist.

Register this opaque playback path in MkLMS only after verification:

```text
media/YOUR_ASSET_ID/master.m3u8
```

## Important

- Transcoding happens once. Future viewers read the already-generated HLS from R2/CDN.
- R2 is permanent storage/delivery; it does not transcode video.
- Local FFmpeg has no cloud transcoding bill; cost is your computer time/electricity.
- Avoid unknown online converters for private/customer material because upload retention, privacy, limits, and output consistency vary.
