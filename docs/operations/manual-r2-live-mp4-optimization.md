# One-time optimization of an existing R2 live-class MP4

This is an opt-in, **non-destructive** workflow for unusually large direct-MP4 live-class recordings. It does not change the live-class player, Cloudflare Workers, database, deployment branches, or any media assignment.

## Scope and safety

- Workflow: **Actions → Optimize existing R2 live-class MP4 (manual, non-destructive) → Run workflow**.
- Source: a private object key such as `media/12345678-1234-1234-1234-123456789abc.mp4` in Starpips' existing `spf-media` R2 bucket. **Do not paste a URL or signing token**.
- Output: unique `media/optimized/<run-id>/<attempt>/optimized.mp4` key in the same bucket; never overwrites the original.
- Encoding: H.264 (`libx264`), slow preset, original resolution/framerate, AAC 128 kbps when audio is present, `yuv420p`, `-movflags +faststart`.
- Quality choices: CRF 18 (larger/high quality), 20 (default), 22 (smaller). This is visually-oriented compression, not mathematically lossless.
- Acceptance: same resolution, approximately same duration, audio presence preserved, H.264 output, at least **3% smaller**, successful remote HEAD and matching object size. Failure leaves original untouched; it does not publish the optimized candidate when compression is insufficient.
- Input size is capped at **2 GiB** on a hosted runner and available disk must pass a preflight check.
- The workflow is manual only, has read-only GitHub permissions, never edits database records, and does not deploy any worker.
- Once it is merged to the default branch, the Actions workflow becomes available for manually initiated conversions.

## Secrets (configure in GitHub Settings → Secrets and variables → Actions)

The workflow uses these **GitHub Actions repository secrets** (not plaintext variables):

- `CLOUDFLARE_ACCOUNT_ID` — existing Cloudflare account ID already referenced by deployment workflows
- `MKLMS_R2_DIRECT_UPLOAD_ACCESS_KEY_ID` — existing R2 direct-upload repository secret; supplied to the optimizer as `R2_ACCESS_KEY_ID`
- `MKLMS_R2_DIRECT_UPLOAD_SECRET_ACCESS_KEY` — existing R2 direct-upload repository secret; supplied to the optimizer as `R2_SECRET_ACCESS_KEY`

The R2 direct-upload secret names were provided as existing GitHub Actions repository secrets. This connection cannot independently enumerate their configured presence; the workflow fails clearly if either is unavailable. Do not paste secret values into a workflow or a chat.

Use a token with Object Read & Write limited to `spf-media`. Cloudflare Worker R2 bindings cannot be accessed from a GitHub-hosted runner. **Do not print credentials or add them to git**. This workflow does not read or change existing Cloudflare Worker secrets.

The R2 bucket name is explicitly `spf-media` so the workflow cannot accidentally write to an unrelated installation. Before using the workflow with another installation, introduce an intentionally reviewed, separately scoped workflow.

## Run it

1. In MKLMS Admin → Media or your R2 object browser, identify the **exact object key** of the troublesome video, not the media asset ID or the signed playback URL.
2. Open GitHub Actions, select the MP4 optimizer, then **Run workflow**.
3. Enter that key and start with quality `20`. For maximum visual fidelity, try `18`; for a further reduction, `22`.
4. Review the Action log and job summary. It prints source and output sizes, percentage savings, duration and output object key.
5. Create a separate **test media record** referencing that new MP4 path, type `DIRECT`, and attach it only to a test session. Verify candlestick labels/text, overlay, audio sync, startup, seeking and mobile-network performance.
6. Only after testing should an operator deliberately decide whether to change the live class's media assignment or replace the original at the same key in a separate, backed-up maintenance operation. This workflow NEVER performs either step.

## Important limits

- Smaller MP4 plus faststart improves the chances of smooth direct playback; it cannot guarantee smooth streaming. Check HTTP 206 range requests, transport latency, buffer stalls, source bitrate and target mobile-network throughput if the problem persists.
- CapCut may have already encoded video efficiently. If the output saves less than 3%, the job fails safely, and no optimized video is published.
- Running more than once creates a new candidate; it does not erase any previous outputs.
- GitHub-hosted CPU/disk/runtime limits apply; this workflow serializes its conversions. Larger recordings require more suitable compute.
- Runtime storage is temporary and deleted on exit. The final asset remains privately stored in R2 only.
- H.264 CRF settings do not guarantee the same visual quality for every source. Check small chart text and annotations carefully.
- Keep `spf-media` private. No public bucket URL is required.
