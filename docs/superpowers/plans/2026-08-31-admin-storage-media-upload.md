# Admin Storage Media Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the obsolete OCI Media Flow admin ingest path with secure multipart admin uploads into private configured storage, automatically registering uploaded MP4s as protected DIRECT media assets.

**Architecture:** Keep the existing StorageProvider abstraction and add a small optional multipart-storage contract implemented by both Cloudflare R2 and S3-compatible providers. A new admin-only upload API creates server-owned object keys, accepts 10 MiB parts, completes/aborts multipart sessions, and registers the completed object through the existing media repository. The existing manual media registration form and protected playback system remain unchanged.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Cloudflare R2 Workers API, AWS SDK S3 multipart commands, PostgreSQL media repository, React client admin UI, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-admin-storage-media-upload-design.md`

## Global Constraints

- Do not change protected playback authorization or the media-delivery Worker contract.
- Do not change student/admin authentication, courses, live classes, billing, certificates, or messaging.
- Do not edit historical migration 009 or add a migration unless implementation proves one is required.
- Cloudflare uses native `APP_STORAGE_BUCKET`; non-Cloudflare keeps S3-compatible fallback.
- Simple admin upload accepts private MP4 only.
- Browser never receives storage credentials or a public storage URL.
- Existing manual media registration remains available.
- Use 10 MiB multipart chunks; all non-final parts satisfy R2/S3 minimum multipart size requirements.

---

### Task 1: Define and test the multipart storage contract

**Files:**
- Modify: `src/providers/storage-provider.ts`
- Modify: `src/providers/cloudflare-r2-storage-provider.ts`
- Modify: `src/providers/s3-compatible-storage-provider.ts`
- Test: `tests/admin-media-upload.test.mjs`

**Interfaces:**
- Produces `MultipartStorageProvider` with `createMultipartUpload`, `uploadPart`, `completeMultipartUpload`, and `abortMultipartUpload`.
- Existing `StorageProvider` behavior remains source-compatible.

- [ ] Write failing tests for provider multipart behavior and key validation.
- [ ] Run the targeted test and verify RED because multipart methods do not yet exist.
- [ ] Add the minimal shared multipart types/interfaces.
- [ ] Implement R2 multipart using bucket create/resume/upload/complete/abort.
- [ ] Implement S3 multipart using CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand.
- [ ] Run targeted tests and verify GREEN.
- [ ] Commit provider changes.

### Task 2: Add server-side upload validation, key generation, and provider selection

**Files:**
- Create: `src/features/media/domain/admin-media-upload.ts`
- Create: `src/features/media/server/admin-media-storage.ts`
- Test: `tests/admin-media-upload.test.mjs`

**Interfaces:**
- `validateAdminMediaUpload({ filename, contentType, sizeBytes })`
- `createMediaUploadKey(filename, now?, id?)`
- `getAdminMediaStorageProvider()` preferring `APP_STORAGE_BUCKET` and falling back to S3 config.

- [ ] Add failing tests for MP4-only validation, bounded size, safe keys, and provider preference.
- [ ] Verify RED.
- [ ] Implement validation with non-empty files and a 2 GiB simple-upload ceiling.
- [ ] Implement server-generated `media/uploads/YYYY/MM/<uuid>-<safe-name>.mp4` keys.
- [ ] Implement provider selection reusing existing Cloudflare/S3 providers.
- [ ] Run targeted tests GREEN.
- [ ] Commit.

### Task 3: Add the authenticated multipart admin API and automatic media registration

**Files:**
- Create: `src/app/api/admin/media/upload/route.ts`
- Modify only if needed: `src/features/media/repositories/postgres-admin-media.repository.ts`
- Test: `tests/admin-media-upload.test.mjs`

**Interfaces:**
- POST JSON `action=create|complete|abort`.
- PUT binary body for a numbered part.
- Completion registers `provider=storage`, `sourceType=DIRECT`, `providerAssetId=key`, `status=READY`.

- [ ] Add static/behavioral failing tests for admin auth, operation validation, registration values, and cleanup on DB failure.
- [ ] Verify RED.
- [ ] Implement create action with admin session, validation, generated key, multipart create, and 10 MiB chunk-size response.
- [ ] Implement PUT part with bounded part number and binary body.
- [ ] Implement complete with sorted validated parts, storage completion, DB media registration, cleanup delete on registration error.
- [ ] Implement abort.
- [ ] Run targeted tests GREEN.
- [ ] Commit.

### Task 4: Replace the OCI admin panel with upload UI while preserving manual registration

**Files:**
- Create: `src/features/media/components/admin-media-upload.tsx`
- Modify: `src/app/(admin)/admin/media/page.tsx`
- Modify: `src/features/media/components/admin-media-manager.tsx` only for wording/layout if required
- Test: `tests/admin-media-upload.test.mjs`

**Interfaces:**
- Client creates upload session, slices file into 10 MiB chunks, uploads sequentially with retry-safe part metadata collection, completes registration, and refreshes page.

- [ ] Add failing UI contract tests requiring upload UI and absence of `MediaIngestPanel`/OCI-first wording from admin page.
- [ ] Verify RED.
- [ ] Implement file/title/duration form and upload progress.
- [ ] Call create -> PUT parts -> complete; call abort on controlled failure where possible.
- [ ] Keep existing manual registration below the upload form.
- [ ] Remove ingest repository/settings loading from `/admin/media` page.
- [ ] Run targeted tests GREEN.
- [ ] Commit.

### Task 5: Documentation and legacy-path cleanup

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `agentmklms.md`
- Modify: `docs/deployment/environment-variables.md`
- Modify: `docs/deployment/r2-project-layout.md`
- Modify: `docs/deployment/production-status-2026-08-31.md`
- Modify: `.env.cloudflare.example` only if clarification is necessary

**Interfaces:**
- Documentation must identify Admin/private-storage upload + protected DIRECT delivery as the standard path and OCI Media Flow as legacy/optional.

- [ ] Update operational source-of-truth docs.
- [ ] Preserve historical OCI documents as reference but label them legacy where surfaced.
- [ ] State no new DB migration is required.
- [ ] Record Cloudflare `APP_STORAGE_BUCKET -> spf-media` and non-Cloudflare S3 fallback.
- [ ] Commit docs.

### Task 6: Full verification and integration

**Files:**
- No new product files unless verification finds a defect.

- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run lint` and require zero errors.
- [ ] Run `npm run build` with CI-safe required env and require success.
- [ ] Run `npm run cf:build` and require success.
- [ ] Run main Worker packaging dry-run.
- [ ] Run protected media Worker packaging dry-run.
- [ ] Run billing Worker packaging dry-run.
- [ ] Confirm migration files 001–011 are unchanged.
- [ ] Open PR only after all verification passes.
- [ ] Review final diff against this spec; merge only the scoped media-upload cleanup.
