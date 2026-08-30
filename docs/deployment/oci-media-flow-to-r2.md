# OCI Media Flow -> Cloudflare R2 — One-Time Transcode Runbook

MkLMS production rule:

```text
original video
  → private OCI Object Storage
  → OCI Media Flow ONCE
  → private OCI HLS output
  → verify output
  → copy complete HLS folder to Cloudflare R2
  → verify R2
  → register R2 master.m3u8 in MkLMS
  → all future viewers use R2/CDN
```

Do not run Media Flow on playback or on deployment. Re-transcode only when the source video or encoding profile changes. Automatic paid OCI orchestration remains OFF by default.

## Fastest first-launch choice

You do **not** need an OCI VM to transcode video. Media Flow and Object Storage are managed OCI services. For the first launch, use the OCI web Console + OCI Cloud Shell. Create an Always Free VM later only if you specifically want a permanent admin/publisher machine.

## Part A — OCI from zero

### 1. Create/sign in to OCI and choose the home region carefully

Create the OCI tenancy and note its **home region**. Always Free Compute is created in the home region. For the first media launch, keep Object Storage and Media Flow in the same region.

Use one compartment such as `mklms-media` if you want resources separated cleanly from other OCI work.

### 2. Create two private Object Storage buckets

OCI Console → Storage → Object Storage & Archive Storage → Buckets.

Create:

- `mklms-media-source` — original MP4/MOV files
- `mklms-media-output` — Media Flow HLS output

Keep both **private / NoPublicAccess**. Do not make the buckets public.

Use predictable object prefixes:

```text
source/free-class-2026/day-1/source.mp4
source/free-class-2026/day-2/source.mp4
source/free-class-2026/day-3/source.mp4

output/free-class-2026/day-1/v1/
output/free-class-2026/day-2/v1/
output/free-class-2026/day-3/v1/
```

### 3. Upload each original video

Open `mklms-media-source` → Objects → Upload.

For the first three videos, upload through OCI Console directly. The Console uses multipart upload for large files. Do not upload a multi-GB source through the MkLMS Cloudflare Worker.

Optional later: use OCI CLI or a short-lived Pre-Authenticated Request for direct uploads.

### 4. Estimate before starting a paid Media Flow job

In MkLMS Admin → Media Library → OCI Media Flow → R2, enter title + duration and create the estimate. The estimator uses a conservative 3-rung Standard H264 profile. Explicitly accepting the estimate records your acknowledgement; it does not start a paid job while automation is OFF.

### 5. Create the reusable Media Flow workflow

OCI Console → navigation menu → Analytics & AI → Media Services → Media Flow → **Create media workflow**.

Basic setup:

- Name: `mklms-hls-standard`
- Compartment: your media compartment
- Input: OCI Object Storage source video
- Codec: H.264 Standard
- Packaging/output: HLS/adaptive bitrate
- Starting rendition plan for this launch: mobile/SD + 720p + 1080p
- Output bucket: `mklms-media-output`
- Job output prefix: a unique video/version prefix
- **Do not enable Media Streams** for this architecture; R2 becomes the permanent playback store.

The workflow is created once and reused. Each video starts one **job** using that workflow.

### 6. Run Day 1, Day 2 and Day 3 as separate jobs

For each source video:

1. Open the workflow → Run Job.
2. Select the correct source object.
3. Set a unique output prefix such as `output/free-class-2026/day-1/v1/`.
4. Review before starting because Media Flow is paid usage.
5. Run the job once.
6. Wait until OCI reports success.

Do not retry by creating a new job just because the browser was refreshed. Check the existing job state first.

### 7. Verify OCI HLS output

Open `mklms-media-output` and the job prefix. Before copying, confirm there is:

- a master `.m3u8` playlist;
- one or more variant `.m3u8` playlists;
- media segment files referenced by those playlists.

If these are missing, do not register the asset in MkLMS and do not delete the source.

## Part B — Create R2 from zero

### 1. Activate R2 and create a bucket

Cloudflare Dashboard → Storage & databases → R2 → Overview.

Activate R2 if the account asks you to complete R2 checkout/subscription activation. Then Create bucket:

- bucket name example: `mklms-media`
- storage class: **Standard**
- keep it private.

### 2. Create bucket-scoped S3 credentials

R2 → Overview → Manage R2 API Tokens → Create token.

Use **Object Read & Write**, scoped only to the `mklms-media` bucket where practical.

Save these once:

- Access Key ID
- Secret Access Key
- S3 endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

Never commit these values to git.

## Part C — Safest manual OCI → R2 copy

For a first launch, the easiest observable method is OCI Cloud Shell + the OCI CLI + rclone for R2.

### 1. Open OCI Cloud Shell

OCI Console → Cloud Shell icon. The OCI CLI is already available in this authenticated shell.

### 2. Download one completed HLS prefix from OCI to Cloud Shell

Example:

```bash
mkdir -p ~/mklms-hls/day1

oci os object bulk-download \
  --bucket-name mklms-media-output \
  --prefix 'output/free-class-2026/day-1/v1/' \
  --download-dir ~/mklms-hls/day1
```

Repeat for day2/day3 after their jobs succeed. Inspect the downloaded directory and locate the master `.m3u8`.

### 3. Configure rclone for R2 once

Use rclone v1.59+.

Run:

```bash
rclone config
```

Choose:

```text
n = New remote
name = r2
storage = Amazon S3 Compliant Storage Providers
provider = Cloudflare R2
access_key_id = <your R2 Access Key ID>
secret_access_key = <your R2 Secret Access Key>
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Keep defaults for options you do not need to change. Credentials live only in your shell/rclone config, not in MkLMS source.

### 4. Copy the complete HLS directory to R2

Example:

```bash
rclone copy ~/mklms-hls/day1 \
  r2:mklms-media/live/free-class-2026/day-1/v1 \
  --progress --checksum
```

Then verify:

```bash
rclone tree r2:mklms-media/live/free-class-2026/day-1/v1
```

Do the same for Day 2 and Day 3.

### 5. Do not delete OCI yet

First verify the R2 tree contains the master playlist, variants and all referenced segments. Keep the original video at least until R2 playback is proven. Cleanup can be a later cost/storage decision.

## Part D — Register R2 media in MkLMS

Admin → Media Library → Register media asset:

- Provider label: `r2`
- Source type: `HLS`
- Duration: actual video duration
- Private provider playback reference: the final R2-relative master path, for example:

```text
live/free-class-2026/day-1/v1/master.m3u8
```

Use the exact master filename OCI generated; it may not literally be named `master.m3u8`.

Then Admin → Live Classes → attach Day 1 asset to Day 1 session, Day 2 to Day 2, Day 3 to Day 3.

A Live Class batch is standalone from paid Courses. Paid Courses may later reuse the same Media Library asset, but the live event does not require a Course or student enrollment.

## Optional Always Free OCI VM

The VM is **not required** for Media Flow or tomorrow's manual copy. If you still want one later:

1. OCI Console → Compute → Instances → Create instance.
2. Use the home region.
3. Choose an image such as Ubuntu or Oracle Linux.
4. Change shape → select `VM.Standard.A1.Flex` and confirm the Console labels the resources Always Free eligible.
5. Stay within your tenancy's Always Free Ampere allocation rather than increasing paid OCPU/RAM.
6. Use only the boot/block storage allowance you intend to keep inside the free tier.
7. Add/download your SSH key safely.
8. Before clicking Create, review every resource for an Always Free indication/cost estimate.

Avoid adding unrelated paid resources such as non-free compute shapes, unnecessary load balancers or oversized storage just to run this media workflow.

## Cost formula used by MkLMS

OCI Media Flow is charged per **minute of output media**, so every rendition contributes minutes.

Current conservative MkLMS launch estimate assumes one SD + two HD outputs in the 30–60 fps band:

```text
SD:  $0.002 per output minute
HD:  $0.004 per output minute
HD:  $0.004 per output minute
-------------------------------
total estimated rate = $0.010 per source-video minute
```

Therefore:

```text
estimated three-video Media Flow cost
= combined duration of all three videos in minutes × $0.010
```

Examples:

```text
3 × 45 min = 135 min  → ~$1.35
3 × 60 min = 180 min  → ~$1.80
3 × 90 min = 270 min  → ~$2.70
3 × 120 min = 360 min → ~$3.60
```

These are processing estimates, not Oracle invoices and not including any storage or other provider usage.

## Future automatic path — intentionally OFF

Preferred future automation remains:

```text
admin gets time-limited direct OCI upload authorization
  ↓
browser uploads directly to OCI source bucket
  ↓
Object Create event
  ↓
Media Workflow Job Spawner
  ↓
ONE Media Flow job
  ↓
completion event
  ↓
OCI-side R2 publisher
  ↓
verify complete R2 HLS tree
  ↓
MkLMS status/media asset becomes READY
```

`MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false` remains the production default until a tiny paid sample has successfully completed this entire loop without duplicate Media Flow jobs.
