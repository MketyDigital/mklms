# Production Course, Media, Quiz, Paid Live, Certificate, and Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair production direct media upload, complete course editing, add first-class quizzes and enrollment-gated paid-course live sessions, prove certificates against `certs/cert.png`, and make managed-hosting billing accrue through the month without tenant-admin billing controls.

**Architecture:** Keep the existing public `/live/[slug]` feature untouched. Add paid live as a separate course-owned authenticated subsystem; keep protected media storage/delivery reusable; use additive migration `013`; centralize billing math so display and checkout use the same calculation.

**Tech Stack:** Next.js 16, React 19, TypeScript, PostgreSQL/pg, Cloudflare Workers/OpenNext, Cloudflare R2/S3 API, AWS SDK v3 presigning, pdf-lib, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-production-course-media-quiz-paid-live-cert-billing-design.md`

## Global Constraints

- Existing public/free `/live/[slug]` remains standalone, public, and behaviorally unchanged.
- Paid live requires authenticated student + active/completed enrollment in the owning course.
- Existing media records and R2 objects remain compatible.
- Historical migrations `001` through `012` are immutable; new schema is migration `013`.
- Tenant admins may view managed-hosting billing but may not edit policy, formula, floor, status, or operator note.
- All behavior changes start with failing regression tests and must pass the full existing CI/build/Worker packaging gate before merge.

---

### Task 1: Add red regression coverage for every requested behavior

**Files:**
- Create: `tests/production-course-media-quiz-paid-live-billing.test.mjs`
- Reuse: `tests/admin-media-upload.test.mjs`, `tests/deployment-live-hosting-regression.test.mjs`, certificate tests

**Interfaces:**
- Produces executable contract assertions for later tasks.

- [ ] Write tests asserting: direct-upload initiation/finalization exists and does not accept client bucket/key; tenant hosting panel does not render `ManagedHostingMonthEditor`; billing accrues by calendar progress; real cert template path is exercised; migration `013` defines quizzes/attempts/paid live; course builder exposes non-prompt editing; paid-live routes require enrollment and do not touch public live routes.
- [ ] Push test-only commit.
- [ ] Require GitHub Actions `Domain tests` to fail for the expected missing behaviors before writing production code.

### Task 2: Fix managed-hosting accrual and remove tenant-admin operator controls

**Files:**
- Modify: `src/features/hosting/domain/managed-hosting.ts`
- Modify: `src/features/hosting/components/managed-hosting-panel.tsx`
- Modify: `src/app/api/managed-hosting/checkout/route.ts`
- Retain operator API protection: `src/app/api/admin/hosting/month/route.ts`

**Interfaces:**
- Produces: `calculateManagedHostingAmountDue({ watchMinutes, policy, monthlyMinimumFloorUsd?, now? })` returning `usageDerivedFeeUsd`, `minimumFloorUsd`, `accruedMinimumUsd`, `amountDueUsd`.

- [ ] Add `now?: Date` to billing calculation and derive month day count/current day in UTC.
- [ ] Compute configured accrued minimum as `minimumMonthlyFeeUsd * day / daysInMonth` rounded to cents.
- [ ] Treat an explicit higher monthly operator floor as immediately authoritative; otherwise use accrued configured minimum.
- [ ] Set `amountDueUsd = max(usageDerivedFeeUsd, accrued/explicit floor)`.
- [ ] Pass the same `now`/current server date path from display and checkout.
- [ ] Remove `ManagedHostingMonthEditor` import/render from tenant admin panel; keep read-only amount/status/payment UI.
- [ ] Run domain tests via CI and confirm billing/admin-control assertions pass.

### Task 3: Add production-safe direct browser-to-R2 upload handshake

**Files:**
- Create: `src/features/media/server/r2-direct-upload.ts`
- Create: `src/app/api/admin/media/direct-upload/initiate/route.ts`
- Create: `src/app/api/admin/media/direct-upload/finalize/route.ts`
- Modify: `src/features/media/components/media-upload-panel.tsx`
- Modify: `.env.cloudflare.example`
- Modify: `docs/deployment/environment-variables.md`
- Keep legacy route for compatibility: `src/app/api/admin/media/upload/route.ts`

**Interfaces:**
- `createDirectR2UploadAuthorization({ title, contentType, sizeBytes, durationSeconds }) -> { uploadUrl, objectKey, expiresAt }`
- `verifyDirectR2Object(objectKey) -> { exists, contentType, contentLength }`

- [ ] Use deployment-owned `MKLMS_R2_DIRECT_UPLOAD_BUCKET`, `MKLMS_R2_DIRECT_UPLOAD_ENDPOINT`, `MKLMS_R2_DIRECT_UPLOAD_ACCESS_KEY_ID`, `MKLMS_R2_DIRECT_UPLOAD_SECRET_ACCESS_KEY` to create an S3 client. Never return credentials.
- [ ] Generate object keys server-side as `media/<uuid>.mp4`; reject non-MP4 metadata and unreasonable/empty sizes.
- [ ] Presign `PutObjectCommand` for the generated key and configured bucket only.
- [ ] Finalize only keys matching `media/<uuid>.mp4`; `HeadObjectCommand` verifies the object before creating the existing `DIRECT` media asset.
- [ ] Update media UI to call initiate, PUT file directly to returned URL, then finalize; show clear configuration/upload/finalize errors.
- [ ] Preserve browse/register-existing-object behavior and protected playback.
- [ ] Document exact Cloudflare R2 S3 credential variables and bucket scoping.
- [ ] Verify tests and production build.

### Task 4: Make course/module/lesson editing complete and form-based

**Files:**
- Modify: `src/features/courses/components/admin/admin-course-manager.tsx`
- Modify: `src/features/courses/components/admin/admin-course-builder.tsx`
- Modify existing admin course/module/lesson PATCH routes/repository validation as needed.

**Interfaces:**
- Existing PATCH routes remain the persistence boundary; UI sends all editable fields explicitly.

- [ ] Replace normal `window.prompt()` editing with inline edit forms/dialog-like panels using existing UI primitives.
- [ ] Course edit supports title/description and publication state while preserving ID/slug unless explicitly supported safely.
- [ ] Module edit supports title/description; add position update if repository supports guarded reorder.
- [ ] Lesson edit supports title, description, media asset, completion mode, completion threshold, duration, status and position where supported.
- [ ] Keep destructive-delete progress protections.
- [ ] Verify existing course CRUD tests plus new full-edit contract assertions.

### Task 5: Add first-class quiz persistence, admin authoring, student scoring and progress

**Files:**
- Create: `db/migrations/013_quizzes_and_paid_course_live.sql`
- Create: `src/features/quizzes/domain/model.ts`
- Create: `src/features/quizzes/repositories/postgres-quiz.repository.ts`
- Create: `src/features/quizzes/services/quiz-scoring.service.ts`
- Create admin APIs under `src/app/api/admin/quizzes/...`
- Create student APIs under `src/app/api/courses/[courseId]/quizzes/...`
- Create: `src/features/quizzes/components/admin-quiz-editor.tsx`
- Create: `src/features/quizzes/components/student-quiz.tsx`
- Modify course builder/student course pages to surface quizzes.
- Modify course-progress/certificate eligibility query to include required published quiz completion.

**Interfaces:**
- `scoreQuizAttempt(quiz, submittedChoiceIds) -> { scorePercent, passed, answers }`; correctness is read from DB/server model only.

- [ ] Migration creates `quizzes`, `quiz_questions`, `quiz_choices`, `quiz_attempts`, `quiz_attempt_answers` with UUID PKs/FKs, ordered positions, pass mark, publication status and timestamps.
- [ ] Admin can create/edit/delete/publish a quiz and its single-answer multiple-choice questions/choices.
- [ ] Student quiz API requires current student session + owning-course enrollment + published course/quiz.
- [ ] Server loads correct choices, scores submitted choice IDs, persists attempt/results, and never trusts browser correctness flags or score.
- [ ] Passing quiz contributes to course completion/certificate eligibility; failing attempt does not.
- [ ] Verify quiz-specific tests plus full suite.

### Task 6: Add paid-course live as a separate enrollment-gated subsystem

**Files:**
- Migration section in `db/migrations/013_quizzes_and_paid_course_live.sql`
- Create: `src/features/paid-live/domain/model.ts`
- Create: `src/features/paid-live/repositories/postgres-paid-live.repository.ts`
- Create: `src/features/paid-live/services/paid-live-state.service.ts`
- Create admin APIs under `src/app/api/admin/courses/[courseId]/paid-live/...`
- Create student APIs under `src/app/api/courses/[courseId]/paid-live/[sessionId]/...`
- Create: `src/features/paid-live/components/admin-paid-live-editor.tsx`
- Create: `src/features/paid-live/components/student-paid-live-room.tsx`
- Add member route under `src/app/(member)/courses/[courseId]/live/[sessionId]/page.tsx`
- Modify course builder/student course page to link sessions.

**Interfaces:**
- `resolvePaidLiveState({ startAt, endAt, now }) -> UPCOMING | LIVE | ENDED`.
- Playback authorization requires authenticated student, active/completed enrollment, published course/session, LIVE state, READY media, then uses existing protected media authorization provider.

- [ ] Migration creates `paid_course_live_sessions` with course/media FKs, title/description, start/end, status and timestamps.
- [ ] Admin CRUD is course-scoped and independent of public live tables.
- [ ] Student route/API rejects unauthenticated, unenrolled, unpublished, not-live, or non-ready-media access.
- [ ] During LIVE, issue the same class of short-lived private media authorization used by protected course playback.
- [ ] Do not import or mutate public live repositories/routes/components except shared low-level media authorization helpers.
- [ ] Add explicit regression assertions that public `/live/[slug]`, `/api/live/[slug]/state`, and `/api/live/[slug]/playback` remain unchanged by this feature.
- [ ] Verify paid-live and public-live tests together.

### Task 7: Prove real certificate rendering with `certs/cert.png`

**Files:**
- Create: `src/features/certificates/providers/default-certificate-layout.ts`
- Modify: `src/features/certificates/providers/pdf-lib-certificate-renderer.ts`
- Create/modify certificate regression test using `certs/cert.png`

**Interfaces:**
- `REAL_CERTIFICATE_DEFAULT_LAYOUT` holds name/date/id placement defaults used when layout config does not override them.

- [ ] Read `certs/cert.png` in the test and provide it through a real in-memory `StorageProvider` implementation.
- [ ] Render a certificate with sample name/date/ID using `PdfLibCertificateRenderer`.
- [ ] Assert PDF signature/non-empty bytes and that rendering succeeds with the real PNG dimensions.
- [ ] Centralize tested default layout coordinates so production issuance and the proof use one layout definition.
- [ ] Verify certificate tests and production build.

### Task 8: Full verification and integration review

**Files:**
- Update: `AGENTS.md` handoff with migrations now through `013` and new production account-side R2 direct-upload credential requirements.

- [ ] Run/require all domain tests green.
- [ ] Require ESLint green.
- [ ] Require Next.js production build green.
- [ ] Require Cloudflare OpenNext build green.
- [ ] Require main Worker dry-run green.
- [ ] Require protected-media Worker dry-run green.
- [ ] Require billing Worker dry-run green.
- [ ] Require CodeQL green.
- [ ] Review branch diff to ensure no unintended public/free live changes.
- [ ] Open a pull request against `main` with migration/deployment instructions; do not merge without an explicit final integration decision.