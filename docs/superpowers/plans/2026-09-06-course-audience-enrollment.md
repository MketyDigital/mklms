# Course Audience and Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make course visibility administratively controllable and reliable for existing/future students, and surface real paid-live sessions on the student dashboard.

**Architecture:** Keep `enrollments` as the single access-control source of truth. Add a course `assignment_mode` policy that drives enrollment creation/synchronization; hook all-active policy into the existing transactional student claim path; query paid live through enrollment rather than weakening paid-live authorization.

**Tech Stack:** Next.js 16 App Router, TypeScript, PostgreSQL, React, Zod, Cloudflare OpenNext/Workers.

**Spec:** `docs/superpowers/specs/2026-09-06-course-audience-enrollment-design.md`

## Global Constraints
- FREE LIVE remains completely independent.
- Existing migration files 001-015 must not be edited.
- Migration 016 defaults existing courses to `SELECTED_STUDENTS` so applying it cannot expose courses unexpectedly.
- Completed enrollment/history is preserved.
- No secret, Cloudflare DNS/SSL/route, R2, Hyperdrive, or billing change.

---

### Task 1: Lock the behavior with regression tests
**Files:**
- Create: `tests/course-audience-enrollment.test.mjs`

**Interfaces:**
- Produces contract coverage for migration, audience API/repository, future-student auto enrollment, dashboard paid-live query, and FREE LIVE isolation.

- [ ] Write tests asserting migration 016 adds `assignment_mode` with `SELECTED_STUDENTS` default and allowed values.
- [ ] Assert admin course page renders the audience manager.
- [ ] Assert repository supports `getCourseAudience` and transactional `setCourseAudience`.
- [ ] Assert all-active SQL enrolls ACTIVE students and selected mode preserves COMPLETED history while revoking only unchecked ACTIVE rows.
- [ ] Assert verified claim auto-enrolls courses with `ALL_ACTIVE_STUDENTS`.
- [ ] Assert dashboard loads real enrollment-scoped published paid-live sessions.
- [ ] Assert FREE LIVE state/playback files are unchanged by the feature.
- [ ] Run `npm test` and confirm RED before implementation.

### Task 2: Add course audience persistence and repository behavior
**Files:**
- Create: `db/migrations/016_course_audience_assignment.sql`
- Modify: `src/features/courses/domain/model.ts`
- Modify: `src/features/courses/repositories/postgres-admin-learning.repository.ts`
- Modify: `src/features/courses/repositories/postgres-learning.repository.ts` only if required for returned model fields.

**Interfaces:**
- `CourseAssignmentMode = "SELECTED_STUDENTS" | "ALL_ACTIVE_STUDENTS"`
- `getCourseAudience(courseId)` returns mode plus enrolled student IDs.
- `setCourseAudience(courseId, mode, selectedStudentIds)` synchronizes enrollments transactionally.

- [ ] Add migration 016 only; do not edit old migrations.
- [ ] Add type/model support.
- [ ] Implement audience reads.
- [ ] Implement all-active bulk enrollment with `INSERT ... SELECT` and `ON CONFLICT`.
- [ ] Implement selected-student activation and unchecked ACTIVE revocation while preserving COMPLETED.
- [ ] Run focused tests until GREEN.

### Task 3: Add admin audience API and UI
**Files:**
- Create: `src/app/api/admin/courses/[courseId]/audience/route.ts`
- Create: `src/features/courses/components/admin/admin-course-audience-manager.tsx`
- Modify: `src/app/(admin)/admin/courses/[courseId]/page.tsx`

**Interfaces:**
- PATCH body `{ mode, studentIds }`.
- UI receives active students, current mode, enrolled IDs.

- [ ] Require valid admin session.
- [ ] Validate mode and student IDs with Zod.
- [ ] Add targeted admin distributed rate limiter consistent with existing security hardening.
- [ ] Render audience manager before course content/live editing.
- [ ] Make “All active students” explanation explicitly include future students.
- [ ] Run focused tests.

### Task 4: Auto-enroll newly activated students
**Files:**
- Modify: `src/features/access/repositories/postgres-access.repository.ts`

**Interfaces:**
- Existing `completeVerifiedClaim()` transaction gains idempotent enrollment into all courses where `assignment_mode='ALL_ACTIVE_STUDENTS'`.

- [ ] Add insert-select before COMMIT.
- [ ] Keep preauthorized course behavior unchanged.
- [ ] Preserve existing students/credentials/claim transaction atomicity.
- [ ] Run access and audience tests.

### Task 5: Surface paid live correctly on the dashboard
**Files:**
- Modify: `src/features/paid-live/repositories/postgres-paid-live.repository.ts`
- Modify: `src/app/(member)/dashboard/page.tsx`

**Interfaces:**
- `listForStudent(studentId, { includeEnded?: boolean })` returns published paid-live sessions only from published courses with ACTIVE/COMPLETED enrollment, including course title.

- [ ] Add enrollment-scoped query.
- [ ] Dashboard loads courses and paid live concurrently.
- [ ] Replace placeholder member-live card with real upcoming/live session cards.
- [ ] Links point to existing `/courses/{courseId}/live/{sessionId}` enrollment-gated route.
- [ ] Keep course-detail paid-live section intact.
- [ ] Run student/paid-live tests.

### Task 6: Handoff documentation and full verification
**Files:**
- Create: `docs/handoff/course-audience-enrollment-2026-09-06.md`
- Update: `AGENTS.md` with stable architecture rule only if appropriate.

- [ ] Document exact admin behavior, SQL semantics, new-student behavior, student dashboard behavior, migration, API, and rollback considerations.
- [ ] Run `npm test` — all tests pass.
- [ ] Run `npm run lint` — no errors.
- [ ] Run `npm run build` — pass.
- [ ] Run `npm run cf:build` — pass.
- [ ] Run main/media/billing `wrangler deploy --dry-run` packaging checks.
- [ ] Review diff against `main` for unrelated changes.
- [ ] Only then merge/deploy and run live smoke checks.