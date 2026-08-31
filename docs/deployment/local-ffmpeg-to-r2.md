# Free local transcoding to Cloudflare R2 — Mac beginner guide

This is the recommended zero-cloud-transcoding-fee workflow for MkLMS:

```text
Original MP4 on your Mac
        ↓
FFmpeg (one-time HLS conversion)
        ↓
HLS folder: master.m3u8 + quality playlists + video segments
        ↓
rclone
        ↓
Private Cloudflare R2 bucket
        ↓
MkLMS stores only: media/<asset-id>/master.m3u8
```

For the current batch of one video up to about 1 hour and two videos around 45 minutes each, **use FFmpeg directly**. HandBrake is not required. Using HandBrake first and FFmpeg second normally makes the Mac encode the same video twice.

## Part 1 — Confirm the tools on your Mac

Open **Terminal**. You can find it with Spotlight: press `Command + Space`, type `Terminal`, then press Enter.

Check FFmpeg:

```bash
ffmpeg -version
```

Check ffprobe:

```bash
ffprobe -version
```

If both commands print version information, FFmpeg is ready.

Check rclone:

```bash
rclone version
```

If Terminal says `command not found`, install rclone with Homebrew:

```bash
brew install rclone
```

If `brew` itself is not installed, install Homebrew from its official website first, then run the command above.

## Part 2 — Put the video somewhere easy to find

For a first run, create a folder on your Desktop called `MKLMS Videos` and put the three original videos inside it.

In Terminal run:

```bash
cd "$HOME/Desktop/MKLMS Videos"
```

List the files:

```bash
ls -lh
```

You should see the three video filenames.

### Important filename rule

If a filename contains spaces, always put it in quotes. Example:

```text
"Forex Class Day 1.mp4"
```

Do not rename or delete the original video until the R2 upload and MkLMS playback are verified.

## Part 3 — Get the MkLMS helper script

The repository already contains:

```text
scripts/transcode-hls.sh
```

The helper creates three H.264 qualities suitable for course/live-class material:

- 360p
- 480p
- 720p
- AAC audio
- 6-second HLS segments

This is intentionally lighter than generating 1080p for every source and is a sensible profile for a 2019 MacBook and mobile students. It also reduces R2 storage and bandwidth requests compared with unnecessarily large renditions.

From a local checkout of the MkLMS repository, make the helper executable once:

```bash
chmod +x scripts/transcode-hls.sh
```

## Part 4 — Transcode the first video

Choose a simple asset ID that contains only letters, numbers and hyphens. Example:

```text
course-01-lesson-01
```

From the MkLMS repository directory, run:

```bash
./scripts/transcode-hls.sh \
  "$HOME/Desktop/MKLMS Videos/Forex Class Day 1.mp4" \
  "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-01"
```

Replace `Forex Class Day 1.mp4` with the real filename.

### What you will see

FFmpeg prints a lot of moving text. That is normal. Useful fields include:

- `frame=` — frames processed
- `time=` — how far through the source FFmpeg has reached
- `speed=` — encoding speed relative to real time

Do not close Terminal or let the Mac shut down while this command is running.

When successful, the final lines include:

```text
HLS package ready: .../master.m3u8
Do not transcode this source again unless you intentionally change the encoding profile.
```

### Expected output structure

```text
hls-course-01-lesson-01/
  master.m3u8
  360p/
    index.m3u8
    seg_000000.ts
    seg_000001.ts
    ...
  480p/
    index.m3u8
    seg_000000.ts
    ...
  720p/
    index.m3u8
    seg_000000.ts
    ...
```

The thousands of small `.ts` files are normal. **Do not upload only `master.m3u8`.** The child playlists and segments are the actual video.

## Part 5 — Verify before uploading

Run:

```bash
ls -lh "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-01/master.m3u8"
```

Then count generated segments:

```bash
find "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-01" -name 'seg_*.ts' | wc -l
```

The count should be much greater than zero.

For a quick syntax check:

```bash
ffprobe "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-01/master.m3u8"
```

For final confidence, open the master playlist in an HLS-capable player such as VLC and scrub near the beginning, middle and end. Confirm picture, sound and lip-sync are correct.

## Part 6 — Create the R2 API credentials

R2 supports an S3-compatible API, which is what rclone uses.

In the Cloudflare dashboard:

1. Open **R2 Object Storage**.
2. Create/select the private bucket you want MkLMS to use.
3. Open **Manage R2 API Tokens**.
4. Create an API token with **Object Read & Write** permission.
5. Restrict it to the MkLMS media bucket if Cloudflare offers the bucket scope in the form.
6. Copy the **Access Key ID** and **Secret Access Key** when Cloudflare shows them.
7. Also note the Cloudflare **Account ID**.

Treat the Secret Access Key like a password. Do not paste it into GitHub source code, a lesson record, or a public chat.

R2's S3 endpoint has this form:

```text
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

That endpoint is for your upload tool/server configuration. It is **not** the course video URL students should receive.

## Part 7 — Configure rclone once

Run:

```bash
rclone config
```

Then follow this beginner sequence:

1. Choose `n` for **New remote**.
2. Name it:

```text
r2
```

3. For storage/provider type choose **S3**.
4. For S3 provider choose **Cloudflare**.
5. Enter the R2 **Access Key ID**.
6. Enter the R2 **Secret Access Key**.
7. For endpoint enter:

```text
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

8. Use region:

```text
auto
```

9. Keep the other values at their defaults unless your R2 token configuration requires otherwise.
10. Save the remote.

Test that rclone can see R2:

```bash
rclone lsd r2:
```

You should see your bucket name.

If a bucket-scoped R2 token causes rclone to complain when checking the bucket, Cloudflare documents `no_check_bucket = true` as an option for configurations that cannot perform bucket-level checks.

## Part 8 — Upload one complete HLS package

Assume:

- your R2 bucket is `mklms-media`
- the asset ID is `course-01-lesson-01`

Run:

```bash
rclone copy \
  "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-01" \
  "r2:mklms-media/media/course-01-lesson-01/" \
  --progress \
  --transfers 16 \
  --checkers 32
```

`rclone copy` is safe to run again if your internet disconnects. It compares source/destination and transfers what still needs to be copied instead of requiring you to start the whole transcoding job again.

### Verify the upload

List the remote asset folder:

```bash
rclone lsf "r2:mklms-media/media/course-01-lesson-01/" --recursive
```

You must see:

- `master.m3u8`
- `360p/index.m3u8`
- `480p/index.m3u8`
- `720p/index.m3u8`
- many `.ts` segments

Check the master object specifically:

```bash
rclone size "r2:mklms-media/media/course-01-lesson-01/"
```

## Part 9 — What to enter in MkLMS

Do **not** enter this:

```text
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/...
```

Do **not** make the bucket public just to get a URL.

Register only the opaque object path:

```text
media/course-01-lesson-01/master.m3u8
```

MkLMS protected playback is responsible for turning that opaque reference into a short-lived authorized delivery URL after it verifies the student, course, lesson and session.

## Part 10 — Repeat for today's other two videos

Use a different output folder and asset ID for every video. Example:

```bash
./scripts/transcode-hls.sh \
  "$HOME/Desktop/MKLMS Videos/Forex Class Day 2.mp4" \
  "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-02"

./scripts/transcode-hls.sh \
  "$HOME/Desktop/MKLMS Videos/Forex Class Day 3.mp4" \
  "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-03"
```

Upload each folder to its matching R2 prefix:

```bash
rclone copy \
  "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-02" \
  "r2:mklms-media/media/course-01-lesson-02/" \
  --progress --transfers 16 --checkers 32

rclone copy \
  "$HOME/Desktop/MKLMS Videos/hls-course-01-lesson-03" \
  "r2:mklms-media/media/course-01-lesson-03/" \
  --progress --transfers 16 --checkers 32
```

You may transcode them one at a time. On a 2019 MacBook this is the conservative approach because three simultaneous software encodes create unnecessary heat and CPU pressure.

## Do I need HandBrake?

Normally, **no**.

Use HandBrake first only when the original file is problematic—for example FFmpeg repeatedly errors on it, the recording has an unusual codec/container, or you specifically need a clean intermediate MP4.

If you do need it:

1. Open the source in HandBrake.
2. Choose an H.264 MP4 preset that keeps the source resolution and frame rate.
3. Export a new MP4.
4. Feed that new MP4 into `scripts/transcode-hls.sh`.

Do not use HandBrake to create three versions and then run FFmpeg again. MkLMS needs HLS playlists/segments; the repository's FFmpeg helper already creates them.

## Disk-space rule

Keep enough free space for:

1. the original video,
2. the generated HLS package,
3. temporary FFmpeg work.

Do not delete the local HLS package until:

- rclone verification succeeds,
- the asset is registered in MkLMS,
- protected playback works from the deployed site,
- seeking works near the beginning/middle/end.

## Security rule

The R2 bucket stays private. R2 API credentials stay server/operator-only. Students must never be given the S3 endpoint or a permanent object URL. The HLS delivery surface must authorize and proxy/rewrite the master playlist, child playlists and segment requests so none of those child requests bypasses MkLMS protection.
