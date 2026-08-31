# Admin Storage Media Upload Design

## Status
Approved for implementation on 2026-08-31.

## Goal
Replace the obsolete OCI Media Flow ingest workflow in the MkLMS admin Media Library with a provider-neutral admin upload flow that stores private media directly in configured application storage and registers it as a protected DIRECT media asset, without changing playback, authentication, course, live-class, billing, certificate, or student behavior.

## Non-goals
- Do not change the protected media-delivery Worker contract.
- Do not change paid-course authorization or free-live scheduling rules.
- Do not change student/admin authentication.
- Do not change certificates, billing, courses, live classes, messages, or database migration history.
- Do not edit migration 009 or any previously applied migration.
- Do not require OCI Media Flow for production.
- Do not make Cloudflare mandatory for non-Cloudflare installations.

## Current problem
`/admin/media` still renders an OCI Media Flow ingest panel and the existing ingest API/repository/domain code models paid transcode jobs. The current production architecture instead uses private direct MP4 objects with protected signed playback through `mklms-media-delivery`.

The main Cloudflare Worker already has `APP_STORAGE_BUCKET -> spf-media`, and the app already has a portable `StorageProvider` abstraction with a Cloudflare R2 implementation and an S3-compatible fallback. The admin media workflow should use that storage abstraction instead of the legacy OCI ingest path.

## User experience
`Admin -> Media Library` will show:

1. **Upload private video**
   - Title
   - Video file (`.mp4`, content type `video/mp4`)
   - Optional duration in seconds
   - Upload progress
   - Clear success/error state

2. **Register existing media asset**
   - Preserve the existing manual registration form for advanced/external media providers.
   - This keeps compatibility with files already uploaded through the Cloudflare R2 dashboard and with YouTube/external/custom providers.

3. **Media library**
   - Preserve the existing asset list.

The old OCI Media Flow panel is removed from the normal admin surface.

## Storage behavior

### Cloudflare
Use the existing `APP_STORAGE_BUCKET` R2 binding through `CloudflareR2StorageProvider`.

### Non-Cloudflare
Use the existing S3-compatible storage provider configured by:
- `MKLMS_STORAGE_BUCKET`
- `MKLMS_STORAGE_REGION`
- `MKLMS_STORAGE_ENDPOINT`
- `MKLMS_STORAGE_ACCESS_KEY_ID`
- `MKLMS_STORAGE_SECRET_ACCESS_KEY`
- `MKLMS_STORAGE_FORCE_PATH_STYLE`

### Object keys
Uploaded video keys are server-generated and private:

`media/uploads/<year>/<month>/<uuid>-<safe-filename>.mp4`

The browser never chooses an arbitrary storage prefix and never receives storage credentials.

## Large-file upload design

Videos can be roughly 200–300 MB, so the browser must not send one giant request through the application Worker. The upload flow uses multipart/chunked upload.

A provider-neutral multipart contract is added alongside `StorageProvider`:

- create multipart upload
- upload one numbered part
- complete multipart upload
- abort multipart upload

Cloudflare implementation uses the native R2 multipart API (`createMultipartUpload`, `resumeMultipartUpload`, `uploadPart`, `complete`, `abort`). S3-compatible implementation uses the corresponding S3 multipart commands.

The client uploads fixed-size chunks. All non-final chunks are at least 5 MiB; the implementation target is 10 MiB chunks. This supports the current 200–300 MB course videos without depending on a single-request body limit.

Upload state remains client-held (`uploadId`, key, uploaded part numbers/ETags). R2 automatically aborts incomplete multipart uploads after its retention window; the UI also calls abort on an explicit cancellation/failure where possible.

## API contract

New admin-only route family:

`/api/admin/media/upload`

All operations require the existing valid admin session.

### POST create
JSON body:
- `action: "create"`
- `filename`
- `contentType`
- `sizeBytes`

Validates MP4 type/extension and bounded size, creates a server-generated key, opens multipart upload, returns `key`, `uploadId`, and recommended chunk size.

### PUT part
Query/body identifies:
- `key`
- `uploadId`
- `partNumber`

Request body is the binary chunk. Returns `partNumber` and `etag`.

### POST complete
JSON body:
- `action: "complete"`
- `key`
- `uploadId`
- `parts: [{ partNumber, etag }]`
- `title`
- optional `durationSeconds`

Completes storage upload and creates the existing media asset record as:
- `provider: "storage"`
- `sourceType: "DIRECT"`
- `providerAssetId: key`
- `status: "READY"`

If DB registration fails after storage completion, the API attempts to delete the uploaded object so an orphan is not intentionally left behind.

### POST abort
JSON body:
- `action: "abort"`
- `key`
- `uploadId`

Aborts the multipart upload.

## Security and validation
- Existing admin session is mandatory for create/part/complete/abort.
- Server generates storage keys.
- Accept MP4 only for the simple upload flow.
- Reject empty files and unreasonable sizes.
- Validate part number range and uploaded-parts payload.
- Never return R2/S3 credentials or public object URLs.
- Uploaded media is private.
- Playback remains through the existing signed delivery Worker and `MKLMS_MEDIA_DELIVERY_BASE_URL`.
- Manual registration remains available for non-uploaded/external media.

## Legacy OCI cleanup
- Remove `MediaIngestPanel` from `/admin/media`.
- Remove OCI-specific wording from the normal admin page.
- Keep historical migration 009 unchanged.
- Legacy ingest tables/API/domain files may remain for backward compatibility unless they are proven unused and removing them would be risk-free; they are not part of the active production path.
- `MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false` remains harmless for old installations but is no longer required for the new admin upload path.
- Documentation marks OCI Media Flow as legacy/optional, not the recommended production workflow.

## Testing
TDD coverage must include:
- upload-key sanitization and server ownership of prefixes;
- MP4/type/size validation;
- multipart Cloudflare provider create/upload/complete/abort;
- S3 multipart provider contract/fallback;
- admin upload route rejects unauthenticated requests;
- completion registers a DIRECT/READY asset with the private key;
- completion cleanup on registration failure;
- `/admin/media` no longer renders OCI ingest panel and does render upload UI;
- existing manual media registration and protected playback tests remain unchanged and green;
- full tests, lint, Next build, OpenNext build, and all three Worker packaging dry-runs remain green.

## Documentation
Update:
- `AGENTS.md`
- `README.md`
- `.env.cloudflare.example` if needed for clarification only
- `docs/deployment/environment-variables.md`
- `docs/deployment/r2-project-layout.md`
- production status/handoff docs

The final source of truth must say the normal media path is Admin upload or operator upload to private storage -> register DIRECT media -> protected delivery Worker.
