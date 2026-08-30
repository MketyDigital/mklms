# OCI Media Flow -> Cloudflare R2 — One-Time Transcode Runbook

This is the MkLMS production media rule:

```text
source video -> OCI Object Storage -> OCI Media Flow ONCE -> verify HLS -> R2 -> future playback
```

Do not run Media Flow on every playback or every deployment. Re-transcode only when the source video or encoding profile changes.

## Recommended first-launch path: manual and observable

For the first production videos, keep `MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false` and complete the steps manually. This removes untested paid-event automation from the launch critical path.

### 1. Prepare OCI buckets

Create or choose two private Object Storage locations in the same OCI region used by Media Flow:

- source bucket/prefix: original MP4/MOV uploads
- output bucket/prefix: completed Media Flow HLS output

Use unique prefixes, for example:

```text
source/free-class-2026/day-1/source.mp4
output/free-class-2026/day-1/v1/
```

### 2. Estimate before starting a paid job

Admin -> Media Library -> OCI Media Flow -> R2 publishing:

- enter video title
- enter duration in minutes
- create estimate
- inspect the estimated Standard H264 cost
- explicitly accept the estimate

The default conservative MkLMS launch profile estimates three output rungs: one SD + two HD outputs in the 30-60fps price band. This is an estimate, not an Oracle invoice.

### 3. Upload source directly to OCI

For the first launch, use one of:

- OCI Console Object Storage upload
- OCI CLI `oci os object put`
- a deliberately time-limited OCI Pre-Authenticated Request (PAR)

Do not send multi-gigabyte source video through the Cloudflare Worker.

### 4. Create/reuse one Media Flow workflow

Create a reusable Media Flow workflow that:

1. reads the source object from OCI Object Storage;
2. transcodes Standard H264 adaptive-bitrate outputs;
3. packages output as HLS;
4. writes the finished output to the selected private OCI output prefix.

The workflow itself is reusable. Each source video creates one Media Flow **job**.

For a simple free-class launch, a reasonable ABR starting point is approximately:

- SD/mobile rendition
- 720p HD rendition
- 1080p HD rendition

Exact bitrates/resolutions should be tested against source quality and expected audience bandwidth before standardizing the encoding profile.

### 5. Run the job and wait for success

From OCI Media Flow, run the workflow against the source object and unique output prefix. Do not start the R2 copy until OCI reports the job succeeded.

Verify output contains:

- master `.m3u8` manifest
- variant `.m3u8` playlists
- referenced media segments

### 6. Copy completed HLS output to R2

Use a trusted machine, OCI Cloud Shell/VM, or a dedicated OCI-side publisher. For the manual path, `rclone` is a practical vendor-neutral option because OCI Object Storage and Cloudflare R2 both expose compatible object-storage interfaces.

Conceptual rclone workflow:

```bash
rclone copy oci:OCI_OUTPUT_BUCKET/free-class-2026/day-1/v1/ \
  r2:R2_MEDIA_BUCKET/live/free-class-2026/day-1/v1/ \
  --checksum --progress
```

Configure both remotes using secrets outside git. Do not paste access keys into MkLMS source files or documentation commits.

### 7. Verify R2 before deleting OCI output

Check that the R2 destination contains the master manifest, all variant playlists and segments. Test playback from the final delivery domain/path.

Only after successful R2 playback verification should OCI source/output cleanup be considered. Keeping the original source elsewhere is recommended if future re-encoding may be required.

### 8. Register final media in MkLMS

Create/register an HLS media asset using the final R2-relative provider path, for example:

```text
live/free-class-2026/day-1/v1/master.m3u8
```

Attach the same Media Library asset to either:

- a Live Class session; or
- a paid Course lesson.

Live Classes and paid Courses do not depend on each other. They simply share the Media Library/platform.

## Future automatic path — keep disabled until smoke tested

Oracle provides a pre-built Media Workflow Job Spawner Function that can react to an Object Storage **Object Create** event and start a Media Flow workflow. The spawner starts the job but does not wait for it to finish.

Preferred future automation:

```text
admin obtains time-limited OCI upload authorization
        ↓
browser uploads directly to OCI source bucket
        ↓
OCI Object Create event
        ↓
Media Workflow Job Spawner Function
        ↓
ONE Media Flow job
        ↓
Media Flow completion event
        ↓
OCI-side R2 publisher/copy job
        ↓
verify R2 master + referenced segments
        ↓
MkLMS authenticated completion callback/status update
        ↓
media asset READY
```

The large file does not pass through the MkLMS Worker. A paid transcode must still have an accepted cost estimate recorded before MkLMS considers automatic processing authorized.

### Smoke-test rule

Before enabling production automation:

1. use a tiny non-sensitive sample video;
2. create and accept the estimate;
3. upload it to the isolated test prefix;
4. confirm exactly one Media Flow job starts;
5. verify HLS is generated;
6. verify the publisher copies the complete HLS tree to the test R2 prefix;
7. verify playback from R2;
8. verify failure/retry does not create uncontrolled duplicate paid jobs;
9. only then set `MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=true` for the real deployment.

The current MkLMS implementation intentionally keeps the paid automation flag OFF by default. The manual path is production-supported even when automation is disabled.

## Cost responsibility

OCI Media Flow cost is based on output-media minutes and the selected codec/resolution/frame-rate profile. Multiple ABR renditions each contribute output minutes. MkLMS estimates should be checked against Oracle's current price list before a large batch.

R2 storage/read-operation costs are separate. R2 Internet egress is currently free. OCI source/output storage and any non-free data transfer are also separate from Media Flow processing.
