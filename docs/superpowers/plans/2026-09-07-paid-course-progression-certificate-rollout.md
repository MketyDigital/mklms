# Paid Course Progression, Certificate Completion, and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair and prove the complete paid-course progression flow from persisted video progress through quiz gating, automatic student advancement, final enrollment completion, certificate issuance, community CTA rendering, and safe deployment to isolated installations.

**Architecture:** Extend existing PostgreSQL repositories to expose persisted lesson progress and quiz pass state, introduce server-authoritative progression helpers for module/quiz gates and next destinations, make all completion paths share the same completion rule, and render/navigate from server-returned state in the student frontend. Preserve protected-media credibility limits and certificate idempotency.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node 24, PostgreSQL/pg, Cloudflare OpenNext/Wrangler, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-07-paid-course-progression-certificate-rollout-design.md`

## Global Constraints

- Do not change FREE Live Classes behavior.
- Do not change paid-live behavior.
- Do not weaken auth or protected-media authorization.
- Persisted DB state is authoritative; client-only progress/gates are insufficient.
- No unrelated refactors.
- Certificate issuance must remain idempotent.
- Starpips infrastructure identifiers remain unchanged during the code fix.

---

### Task 1: Add RED progression and cumulative-progress contracts

**Files:**
- Create: `tests/paid-course-progression-e2e.test.mjs`
- Modify later: course/media/quiz services and repositories.

**Interfaces:**
- Expected `LessonProgressRecord` read contract.
- Expected paid-course progression helpers returning lesson/quiz accessibility and `NextLearningDestination`.

- [ ] Write failing tests proving persisted partial progress is cumulative, module quiz gates exist, later modules require prior quiz passes, video-only 100% cannot complete a quiz-requiring course, and final quiz pass resolves to certificates.
- [ ] Run CI and confirm failures are caused by missing behavior/interfaces rather than syntax errors.

### Task 2: Persisted lesson-progress read model

**Files:**
- Modify: `src/features/courses/services/student-learning.service.ts`
- Modify: `src/features/courses/repositories/postgres-learning.repository.ts`
- Modify: `src/features/media/services/video-progress.service.ts`
- Modify: `src/features/media/repositories/postgres-video-progress.repository.ts`
- Test: `tests/paid-course-progression-e2e.test.mjs`

**Interfaces:**

```ts
export interface LessonProgressRecord {
  lessonId: string;
  progressPercent: number;
  lastPositionSeconds: number;
  completed: boolean;
}
```

Repository methods return persisted progress for a lesson/course. Student lesson views include `progressPercent`/`lastPositionSeconds`.

- [ ] Add the repository read query from `lesson_progress`.
- [ ] Make student course view hydrate partial progress.
- [ ] Make `VideoProgressService` return the maximum of prior persisted progress and newly credible progress.
- [ ] Keep existing monotonic PostgreSQL writes.
- [ ] Run focused tests to GREEN.

### Task 3: Server-authoritative module/quiz progression

**Files:**
- Create: `src/features/courses/domain/paid-course-progression.ts`
- Modify: `src/features/courses/services/student-learning.service.ts`
- Modify: `src/features/media/services/media-playback.service.ts`
- Modify: `src/features/media/services/video-progress.service.ts`
- Modify: repository interfaces/implementations as required.

**Interfaces:**

```ts
export interface PublishedQuizGate {
  id: string;
  moduleId: string;
  position: number;
}

export type NextLearningDestination =
  | { type: "QUIZ"; quizId: string }
  | { type: "LESSON"; lessonId: string }
  | { type: "CERTIFICATES" }
  | { type: "COURSE" }
  | null;
```

Helpers determine `canAccessLessonWithQuizzes`, `canAccessQuiz`, `areCourseRequirementsComplete`, and next destination from ordered modules/lessons/quizzes.

- [ ] Implement pure domain helpers.
- [ ] Add repository methods for published quiz gates/passed quiz IDs where needed.
- [ ] Enforce quiz-aware gates in playback authorization and progress mutation.
- [ ] Use the same gate model in the student course read model.
- [ ] Run focused tests to GREEN.

### Task 4: Quiz attempt progression and final certificate ensure

**Files:**
- Modify: `src/app/api/courses/[courseId]/quizzes/[quizId]/attempt/route.ts`
- Modify: `src/features/quizzes/components/student-quiz.tsx`
- Test: `tests/paid-course-progression-e2e.test.mjs`

**Interfaces:**

Successful response adds:

```ts
{
  nextDestination: NextLearningDestination;
  courseCompleted: boolean;
  certificate: EnsureCourseCertificateResult | null;
}
```

- [ ] Reject quiz attempt when its module lessons/gates are not satisfied.
- [ ] After pass, reload persisted lesson/pass state and evaluate course completion.
- [ ] Mark enrollment completed only when all published lessons and quizzes are satisfied.
- [ ] If final completion occurs, call `ensureCourseCertificate` after the enrollment update.
- [ ] Return deterministic next destination.
- [ ] Make `StudentQuiz` navigate with `useRouter()` after a successful pass while retaining visible pass feedback briefly.
- [ ] Run focused tests to GREEN.

### Task 5: Lesson player hydration and automatic transition

**Files:**
- Modify: `src/features/media/components/protected-lesson-player.tsx`
- Modify: `src/app/(member)/courses/[courseId]/lessons/[lessonId]/page.tsx`
- Modify: `src/app/api/courses/[courseId]/lessons/[lessonId]/progress/route.ts`
- Modify manual-complete route if needed.

**Interfaces:**

Player props include persisted initial progress. Progress responses include next destination and certificate status when completion occurs.

- [ ] Pass persisted progress from server-rendered lesson page into the player.
- [ ] Initialize visible credited progress from DB state.
- [ ] Keep updates monotonic from successful server responses.
- [ ] Route automatically to quiz/next lesson/certificates after threshold completion.
- [ ] Ensure video completion checks quizzes before enrollment completion.
- [ ] Ensure certificate is invoked only when shared completion rule is satisfied.
- [ ] Run focused tests to GREEN.

### Task 6: Course overview gates and rendered progress

**Files:**
- Modify: `src/app/(member)/courses/[courseId]/page.tsx`
- Modify: `src/features/courses/services/student-learning.service.ts`

**Interfaces:**
- Server view exposes persisted partial progress and quiz lock/pass state.

- [ ] Render each lesson's persisted partial percentage where incomplete.
- [ ] Render module quizzes locked until module lessons are complete.
- [ ] Render later modules locked until required earlier quizzes pass.
- [ ] Ensure UI link availability matches server API/playback authorization.
- [ ] Run frontend/static regression tests.

### Task 7: Certificate/community completion verification

**Files:**
- Inspect/modify only if needed: `src/features/certificates/server/ensure-course-certificate.ts`
- Inspect/modify only if needed: `src/app/(member)/certificates/page.tsx`
- Test: existing certificate/community tests + new flow test.

- [ ] Prove final quiz path issues/ensures certificate idempotently.
- [ ] Prove repeated completion does not duplicate certificates.
- [ ] Prove community link renders only with active certificate and configured persisted URL.
- [ ] Preserve pending/delivery-failure statuses accurately.

### Task 8: Full verification and review

- [ ] Run all domain tests.
- [ ] Run lint.
- [ ] Run Next.js production build.
- [ ] Run Cloudflare OpenNext build.
- [ ] Run main Worker packaging dry-run.
- [ ] Run media Worker packaging dry-run.
- [ ] Run billing Worker packaging dry-run.
- [ ] Audit diff for unrelated runtime/live/auth/billing changes.
- [ ] Confirm `production/starpips` has not moved during development.

### Task 9: Integrate to main and promote Starpips

- [ ] Open PR against `main`.
- [ ] Require green CI and exact-head merge guard.
- [ ] Merge verified fix to `main`.
- [ ] Re-run post-merge CI.
- [ ] Promote exact verified merge commit to `production/starpips` only after the prior checks pass.
- [ ] Verify Cloudflare deployment evidence before claiming live success.
- [ ] Run/read production smoke evidence for progress, quiz advancement, certificate/community flow without modifying unrelated data.

### Task 10: Mkety Academy isolated rollout

- [ ] Complete Phase 4 isolated resource provisioning for Mkety Academy.
- [ ] Use a separate PostgreSQL DB, Hyperdrives, R2 bucket, rate-limit namespaces, Workers, secrets, billing ID, and domain.
- [ ] Run migrations only against the Mkety database.
- [ ] Create/promote `production/mkety-academy` from the exact verified code commit.
- [ ] Deploy and smoke-test independently from Starpips.
