# Course Audience and Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make course visibility administratively controllable and reliable for existing/future students, and surface real paid-live sessions on the student dashboard.

**Architecture:** Keep `enrollments` as the single access-control source of truth. Add a course `assignment_mode` policy that drives transactional enrollment synchronization; enforce future all-active enrollment with a PostgreSQL student-status trigger; query paid live through enrollment rather than weakening paid-live authorization.

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
- Produces contract coverage for migration, activation trigger, audience API/repository, dashboard paid-live query, paid-live access checks, and FREE LIVE isolation.

- [x] Write tests asserting migration 016 adds `assignment_mode` with `SELECTED_STUDENTS` default and allowed values.
- [x] Assert migration installs an ACTIVE-student trigger for `ALL_ACTIVE_STUDENTS` courses.
- [x] Assert admin course page renders the audience manager and complete active-student list.
- [x] Assert repository supports `getCourseAudience`, `listActiveStudents`, and transactional `setCourseAudience`.
- [x] Assert all-active SQL bulk-enrolls ACTIVE students and selected mode preserves COMPLETED history while revoking only unchecked ACTIVE rows.
- [x] Assert dashboard loads real enrollment-scoped published paid-live sessions.
- [x] Assert paid-live join/playback remain enrollment gated.
- [x] Assert FREE LIVE state/playback files remain independent.
- [ ] Execute tests. GitHub-hosted Actions currently fails before step 1, so command verification remains pending.

### Task 2: Add course audience persistence and repository behavior
**Files:**
- Create: `db/migrations/016_course_audience_assignment.sql`
- Modify: `src/features/courses/domain/model.ts`
- Create: `src/features/courses/repositories/postgres-course-audience.repository.ts`

**Interfaces:**
- `CourseAssignmentMode = "SELECTED_STUDENTS" | "ALL_ACTIVE_STUDENTS"`
- `listActiveStudents()` returns the complete current ACTIVE audience list without the unrelated admin-list limit.
- `getCourseAudience(courseId)` returns mode plus active/completed enrolled student IDs.
- `setCourseAudience(courseId, mode, selectedStudentIds)` synchronizes enrollments transactionally.

- [x] Add migration 016 only; do not edit old migrations.
- [x] Add type/model support.
- [x] Implement complete active-student audience reads.
- [x] Implement all-active bulk enrollment with `INSERT ... SELECT` and `ON CONFLICT`.
- [x] Implement selected-student activation and unchecked ACTIVE revocation while preserving COMPLETED.
- [x] Use bulk SQL rather than one database round trip per student.
- [ ] Execute focused tests when a runner is available.

### Task 3: Add admin audience API and UI
**Files:**
- Create: `src/app/api/admin/courses/[courseId]/audience/route.ts`
- Create: `src/features/courses/components/admin/admin-course-audience-manager.tsx`
- Modify: `src/app/(admin)/admin/courses/[courseId]/page.tsx`

**Interfaces:**
- PATCH body `{ mode, studentIds }`.
- UI receives complete active students, current mode, and current active enrollment IDs.

- [x] Require valid admin session.
- [x] Validate mode and student IDs with Zod.
- [x] Add `ADMIN_RATE_LIMITER` consistent with existing security hardening.
- [x] Render audience manager before course content/live editing.
- [x] Make “All active students” explanation explicitly include future students.
- [x] Support Select all / Clear all.
- [x] Keep returned selection state scoped to currently ACTIVE student IDs.
- [ ] Execute focused tests when a runner is available.

### Task 4: Auto-enroll newly activated students
**Files:**
- Implemented in: `db/migrations/016_course_audience_assignment.sql`
- No access repository modification required.

**Interfaces:**
- PostgreSQL trigger `mklms_students_all_active_course_enrollment` fires after student INSERT or status UPDATE.
- Function `mklms_enroll_active_student_in_all_courses()` idempotently enrolls an ACTIVE student into all `ALL_ACTIVE_STUDENTS` courses.

- [x] Trigger only when the new status is ACTIVE and the row is newly inserted or has changed status.
- [x] Use `INSERT ... SELECT` from courses and `ON CONFLICT (student_id, course_id)`.
- [x] Preserve COMPLETED enrollment status.
- [x] Keep existing preauthorized course/claim behavior unchanged.
- [x] Cover future activation paths, not only today's claim route.
- [ ] Execute migration/access tests when a runner is available.

### Task 5: Surface paid live correctly on the dashboard
**Files:**
- Modify: `src/features/paid-live/repositories/postgres-paid-live.repository.ts`
- Modify: `src/app/(member)/dashboard/page.tsx`

**Interfaces:**
- `listForStudent(studentId, { includeEnded?: boolean })` returns published paid-live sessions only from published courses with ACTIVE/COMPLETED enrollment, including course title.

- [x] Add enrollment-scoped query.
- [x] Dashboard loads courses and paid live concurrently.
- [x] Replace placeholder member-live card with real upcoming/live session cards.
- [x] Links point to existing `/courses/{courseId}/live/{sessionId}` enrollment-gated route.
- [x] Keep course-detail paid-live section intact.
- [x] Audit Zoom join and protected-video playback routes: both independently require published course/session and ACTIVE/COMPLETED enrollment.
- [ ] Execute student/paid-live tests when a runner is available.

### Task 6: Handoff documentation and full verification
**Files:**
- Create: `docs/handoff/course-audience-enrollment-2026-09-06.md`

- [ ] Document exact admin behavior, SQL semantics, activation trigger, student dashboard behavior, migration, API, deployment order, and rollback considerations.
- [ ] Run `npm test` — all tests pass.
- [ ] Run `npm run lint` — no errors.
- [ ] Run `npm run build` — pass.
- [ ] Run `npm run cf:build` — pass.
- [ ] Run main/media/billing `wrangler deploy --dry-run` packaging checks.
- [ ] Review diff against `main` for unrelated changes.
- [ ] Remove temporary branch-only workflow before merge.
- [ ] Apply migration 016 before relying on the new admin page/API.
- [ ] Only then merge/deploy and run live smoke checks.