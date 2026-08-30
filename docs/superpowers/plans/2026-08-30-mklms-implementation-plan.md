# MkLMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved reusable white-label MkLMS platform in four independently testable phases: platform/access foundation, learning/progress, certificates/media, and live classes.

**Architecture:** Keep the existing Next.js 16 feature/service structure, move business rules into provider-neutral TypeScript domain modules, and add PostgreSQL/storage/media/email/auth adapters behind interfaces. `main` remains the LMS base; `mkwebinar` is reference-only. Each phase must update `agentmklms.md` before completion.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Zod 4, Node 22 test runner for pure domain tests; PostgreSQL semantics with provider adapters added during persistence work.

**Spec:** `docs/superpowers/specs/2026-08-30-mklms-reusable-learning-platform-design.md`

## Global Constraints

- White-label: no hardcoded customer/business identity in reusable code.
- Payments/marketing are external to MkLMS.
- Paid portal is public but first-time claim succeeds only for pre-authorized students.
- OTP is optional; verification strategy is deployment-configurable.
- Persistent access code is distinct from first-time verification and must be stored securely.
- PostgreSQL/storage/media/email/auth/notification providers remain swappable.
- Media origins should be private and playback authorization short-lived where provider supports it.
- Webinar simulated-live offset is server-clock driven.
- Never edit `MketyDigital/Mkety` for this work.
- Every meaningful batch updates `agentmklms.md` progress ledger.

---

## Phase 1 — Platform foundation, white-label settings, pre-authorization and access

### Task 1: Add test harness and pure access domain

**Files:**
- Modify: `package.json`
- Create: `tests/access-domain.test.mjs`
- Create: `src/features/access/domain/access-code.ts`
- Create: `src/features/access/domain/preauthorization.ts`
- Create: `src/features/access/types.ts`

**Interfaces:**
- Produces `generateAccessCode`, `hashAccessCode`, `verifyAccessCode`, `normalizeIdentity`, `findMatchingPreauthorization`, and access/preauthorization types used by API/repository layers.

- [ ] Write failing tests for normalization, approved-record matching, cryptographically random access code format, hash verification, and neutral failed-match behavior.
- [ ] Run `npm test` and confirm failure because the domain functions do not exist.
- [ ] Implement the minimal pure TypeScript domain functions.
- [ ] Run `npm test` and confirm all access-domain tests pass.
- [ ] Commit.

### Task 2: Model configurable claim verification and white-label settings

**Files:**
- Create: `src/features/access/domain/claim-verification.ts`
- Create: `src/features/settings/platform-settings.ts`
- Modify: `tests/access-domain.test.mjs`
- Modify: `src/features/settings/types.ts`

**Interfaces:**
- Produces `ClaimVerificationStrategy`, `ClaimVerificationProvider`, `PlatformSettings`, and validation helpers.

- [ ] Add failing tests that OTP is optional and supported strategies include preauth-only, email OTP, SMS OTP, claim code, manual approval, and custom.
- [ ] Run tests and confirm expected failure.
- [ ] Implement strategy/configuration types and helpers without provider SDK dependencies.
- [ ] Run tests and confirm pass.
- [ ] Commit.

### Task 3: Add scalable pre-authorization import utilities

**Files:**
- Create: `src/features/access/domain/import-preauthorizations.ts`
- Create: `tests/preauthorization-import.test.mjs`

**Interfaces:**
- Produces `parsePreauthorizationCsv`, `parsePreauthorizationPaste`, and normalized import rows.

- [ ] Write failing tests for CSV and bulk-paste import, duplicate detection, whitespace normalization, and invalid-row reporting.
- [ ] Run tests and confirm failure.
- [ ] Implement parsers as provider-neutral pure functions.
- [ ] Run tests and confirm pass.
- [ ] Commit.

### Task 4: Replace template auth/onboarding copy and route model with MkLMS access flow

**Files:**
- Modify: `src/features/auth/types.ts`
- Modify: `src/config/routes.ts`
- Modify: `src/config/navigation.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/onboarding/page.tsx`
- Create: `src/features/access/components/access-code-form.tsx`
- Create: `src/features/access/components/claim-access-form.tsx`

**Interfaces:**
- `/login` becomes returning-student access-code entry.
- `/onboarding` becomes first-time approved-student claim/certificate identity flow.
- Removes Bkash/Nagad/Google-only assumptions from these routes.

- [ ] Add static/domain assertions where possible before UI code.
- [ ] Implement reusable, neutral UI copy and inputs.
- [ ] Verify route/navigation exports and pure tests.
- [ ] Commit.

### Task 5: Add persistence contracts and first PostgreSQL repository boundary

**Files:**
- Create: `src/features/access/repositories/access.repository.ts`
- Create: `src/features/settings/repositories/settings.repository.ts`
- Create: `src/features/access/services/access.service.ts`
- Create: `src/features/access/services/access.service.test.mjs` or extend top-level tests if Node module resolution requires it.
- Create: `db/migrations/001_mklms_foundation.sql`

**Interfaces:**
- Repository methods for preauthorization lookup/create/import, student claim, credential replace/revoke, enrollment activation, platform settings read/update.
- SQL creates provider-neutral PostgreSQL tables for platform settings, students, preauthorizations, access credentials, and enrollments.

- [ ] Write failing service tests against an in-memory repository double.
- [ ] Verify failure.
- [ ] Implement service orchestration and SQL migration contract.
- [ ] Verify service tests pass.
- [ ] Commit.

### Task 6: Update persistent agent progress

**Files:**
- Modify: `agentmklms.md`

- [ ] Record verified Phase 1 implementation state, test evidence, remaining persistence/UI integration work, and exact branch.
- [ ] Commit.

---

## Phase 2 — Courses, modules, lessons, enrollments and progress

### Task 7: Replace video-centric course model with course → module → lesson domain

**Files:**
- Modify: `src/features/courses/types.ts`
- Modify: `src/features/courses/services/course.service.ts`
- Add focused domain modules under `src/features/courses/domain/`
- Extend PostgreSQL migration(s).
- Add `tests/course-progress.test.mjs`.

**Interfaces:**
- `Course`, `Module`, `Lesson`, `Enrollment`, `LessonProgress`.
- `canAccessLesson`, `calculateCourseProgress`, `markLessonCompleted`.

- [ ] Write failing tests for sequential unlocking.
- [ ] Verify failure.
- [ ] Implement minimal domain logic.
- [ ] Verify pass.
- [ ] Refactor existing course UI/service types to use lesson/media terminology.
- [ ] Commit.

### Task 8: Implement completion behavior

- [ ] Test that prior lessons gate next lesson before completion.
- [ ] Test that 100% completion marks enrollment complete.
- [ ] Test that completed students may revisit any lesson regardless of sequence.
- [ ] Implement and verify.
- [ ] Commit.

### Task 9: Rebuild student/admin course navigation and remove subscription/payment UI

**Files:**
- Modify member/admin routes/navigation/pages.
- Remove subscription/payment routes from primary navigation and reusable product flow.
- Add admin enrollment/access pages and student progress route.

- [ ] Implement route/navigation changes following tested domain contracts.
- [ ] Verify build/lint when CI/runtime is available.
- [ ] Commit.

### Task 10: Update `agentmklms.md` Phase 2 progress

---

## Phase 3 — Certificates, storage/media adapters, protected playback and messaging integration

### Task 11: Certificate domain and ID generation

- [ ] Write failing tests for idempotent issuance, configurable prefixes, snapshot identity, revocation state.
- [ ] Implement certificate domain.
- [ ] Verify pass.
- [ ] Commit.

### Task 12: Certificate renderer/storage/email interfaces

**Interfaces:**
- `CertificateRenderer`
- `StorageProvider`
- `EmailProvider`

- [ ] Test orchestration with in-memory adapters.
- [ ] Implement provider-neutral service.
- [ ] Add PDF renderer adapter and template-layout configuration.
- [ ] Add admin resend/download/message actions.
- [ ] Commit.

### Task 13: Media provider abstraction and protected playback

**Interfaces:**
- `MediaProvider.createUpload`
- `MediaProvider.getAsset`
- `MediaProvider.createPlaybackAuthorization`
- `MediaProvider.revokeAsset`
- `MediaProvider.deleteAsset`

- [ ] Write failing authorization tests for enrollment/session/time checks.
- [ ] Implement generic media asset model and signed/short-lived playback contract.
- [ ] Replace `youtubeUrl`-only model.
- [ ] Add optional watermark configuration.
- [ ] Commit.

### Task 14: Integrate certificates with existing messaging

- [ ] Extend message attachments/context.
- [ ] Test certificate resend/message workflow.
- [ ] Implement admin/student UI integration.
- [ ] Commit.

### Task 15: Update `agentmklms.md` Phase 3 progress

---

## Phase 4 — Live classes / webinar consolidation

### Task 16: Live batch/session resolver

- [ ] Write failing tests for UPCOMING, LIVE, BETWEEN_SESSIONS, and ENDED states.
- [ ] Test `offsetSeconds = serverNow - startsAt` and rejoin behavior.
- [ ] Implement pure session resolver.
- [ ] Verify pass.
- [ ] Commit.

### Task 17: Rebuild simulated-live player as a Next.js feature

- [ ] Extract behavioral lessons from `mkwebinar/js/player.js` without copying its standalone architecture.
- [ ] Implement provider-neutral player adapter usage.
- [ ] Prevent user seeking where supported and correct drift.
- [ ] Verify with pure resolver/player-state tests.
- [ ] Commit.

### Task 18: Timeline chat import and playback synchronization

- [ ] Write failing tests for late-join cursor, recent-context window, ordering, and edit/delete behavior.
- [ ] Implement timeline domain and import parser.
- [ ] Build admin preview/editor.
- [ ] Commit.

### Task 19: Private attendee messaging and notification adapters

- [ ] Test attendee sees own message + staged chat but not other real attendee messages.
- [ ] Implement live-class threads through core messaging.
- [ ] Add `NotificationProvider` contract and Telegram adapter configuration.
- [ ] Commit.

### Task 20: Admin live-class UX and public batch route

- [ ] Build `/admin/live` batch/session controls.
- [ ] Build `/live/[batchSlug]` countdown/live/ended state.
- [ ] Implement per-session CTA and expiry redirect/message.
- [ ] Verify domain tests and build/lint.
- [ ] Commit.

### Task 21: Final white-label/security verification and progress ledger

- [ ] Search for hardcoded legacy brand/payment strings and remove reusable-core assumptions.
- [ ] Verify private-media contract and neutral claim responses.
- [ ] Run full tests/build/lint.
- [ ] Update `agentmklms.md` with complete status and deferred provider-specific deployment adapters.
- [ ] Commit and prepare PR.
