# MkLMS Course Audience / Enrollment / Paid Live Handoff — 2026-09-06

## Why this change exists

Students could have an active MkLMS account but see no course on `/dashboard` because course visibility is intentionally driven by `enrollments`. Publishing a course did not create enrollment rows. The admin could associate one course with a preauthorization, but there was no course-level tool to assign an existing course to all students or selected existing students, and there was no persistent rule for future students.

The student dashboard also contained only placeholder text for member live sessions. Real paid-course live sessions existed and were enrollment-gated inside each course, but were not surfaced on the dashboard.

## Final architecture

`enrollments` remains the single source of truth for paid-course access. This feature does not make published courses globally readable and does not bypass enrollment checks.

Each course has an `assignment_mode`:

- `SELECTED_STUDENTS` — safe default. Only explicitly assigned ACTIVE students plus preserved COMPLETED enrollments can see the published course.
- `ALL_ACTIVE_STUDENTS` — all current ACTIVE students are enrolled immediately, and future students are enrolled automatically whenever their account becomes ACTIVE.

FREE LIVE remains a separate public webinar subsystem.

## Database migration

New migration:

`db/migrations/016_course_audience_assignment.sql`

It:

1. Adds `courses.assignment_mode TEXT NOT NULL DEFAULT 'SELECTED_STUDENTS'`.
2. Adds a check constraint allowing only `SELECTED_STUDENTS` and `ALL_ACTIVE_STUDENTS`.
3. Adds an `(assignment_mode, status)` index.
4. Creates `mklms_enroll_active_student_in_all_courses()`.
5. Creates trigger `mklms_students_all_active_course_enrollment` on `students` after INSERT or status UPDATE.

The trigger runs only when the new student status is `ACTIVE` and the student is newly inserted or changed to ACTIVE. It inserts an ACTIVE enrollment for every course currently set to `ALL_ACTIVE_STUDENTS` using `ON CONFLICT (student_id, course_id)`.

If an enrollment is already `COMPLETED`, the trigger preserves `COMPLETED`; it never resets course completion.

### Why the trigger is used

The rule is tied to the database event “student becomes ACTIVE,” not to one particular API route. This means first-time claims, admin reactivation, and future activation pathways all receive the same behavior atomically.

## Admin course audience controls

New repository:

`src/features/courses/repositories/postgres-course-audience.repository.ts`

It provides:

- `listActiveStudents()` — complete ACTIVE-student list for course assignment, with no unrelated 5,000-member admin-list cap.
- `getCourseAudience(courseId)` — current assignment mode plus ACTIVE/COMPLETED enrolled student IDs.
- `setCourseAudience(courseId, mode, selectedStudentIds)` — transactional synchronization.

### ALL_ACTIVE_STUDENTS save behavior

One bulk `INSERT ... SELECT` enrolls every current ACTIVE student. `ON CONFLICT` reactivates non-completed enrollment rows and preserves completed rows. This avoids one database round trip per student.

### SELECTED_STUDENTS save behavior

- Submitted IDs are deduplicated.
- Only students whose account status is currently ACTIVE are accepted.
- Checked students are bulk inserted/reactivated.
- Unchecked `ACTIVE` enrollment rows for the course become `REVOKED`.
- `COMPLETED` enrollments are never revoked by audience synchronization.
- Lesson progress, quiz history, certificates, and other course history are not deleted.

## Admin API

New route:

`PATCH /api/admin/courses/[courseId]/audience`

Request body:

```json
{
  "mode": "SELECTED_STUDENTS | ALL_ACTIVE_STUDENTS",
  "studentIds": ["student-id", "..."]
}
```

Protection:

- valid admin session required;
- Zod input validation;
- existing `ADMIN_RATE_LIMITER` used;
- non-active selected student IDs are rejected;
- transaction rolls back on failure.

For `ALL_ACTIVE_STUDENTS`, `studentIds` is ignored and the database selects the current ACTIVE population itself.

## Admin UI

New component:

`src/features/courses/components/admin/admin-course-audience-manager.tsx`

It is rendered at the top of:

`/admin/courses/[courseId]`

Admin choices:

1. **All active students** — UI explains that current active students are enrolled now and future active students will be auto-enrolled.
2. **Selected students** — checkbox list of all current ACTIVE students, with Select all / Clear all.

The page obtains the complete active-student list directly from the course-audience repository instead of using the generic limited member listing.

## Existing courses after migration

Migration 016 intentionally defaults every existing course to `SELECTED_STUDENTS`. Applying the migration alone therefore does **not** suddenly expose a course to everyone.

For an existing course that should be visible to everybody:

1. Open Admin -> Courses -> that course.
2. In **Course audience**, choose **All active students**.
3. Click **Save course audience**.

That immediately creates/repairs the required enrollment rows for all current ACTIVE students. Future ACTIVE students will then be added automatically by the database trigger.

If only some students should receive the course, choose **Selected students**, check them, and save.

## Student dashboard behavior

Existing course behavior remains:

`StudentLearningService.listMyCourses()` only returns:

- courses with a real ACTIVE or COMPLETED enrollment; and
- published course content.

The new assignment system fixes missing enrollment rows instead of bypassing that service.

The dashboard now also calls:

`PostgresPaidLiveRepository.listForStudent(studentId)`

It returns only paid-live sessions where:

- the student has ACTIVE or COMPLETED enrollment in the course;
- the course is PUBLISHED;
- the paid-live session is PUBLISHED;
- the session has not already ended (unless explicitly requested by a future caller).

Dashboard cards show:

- session title;
- course title;
- UPCOMING/LIVE state;
- scheduled start/end;
- a link to `/courses/{courseId}/live/{sessionId}`.

Course detail retains its existing Paid live sessions section.

## Paid-live security audit

Surfacing a paid-live link on the dashboard does not grant access by itself.

The existing Zoom join endpoint independently requires:

- authenticated student session;
- matching course/session;
- PUBLISHED session;
- PUBLISHED course;
- ACTIVE or COMPLETED course enrollment;
- LIVE time window;
- valid Zoom URL.

The hosted-video playback endpoint independently requires:

- authenticated student session;
- PUBLISHED course/session;
- ACTIVE or COMPLETED enrollment;
- permitted managed-hosting state;
- LIVE time window;
- ready protected media;
- short-lived playback authorization.

## FREE LIVE isolation

This feature does not modify:

- `/live/[slug]`;
- `/api/live/[slug]/state`;
- `/api/live/[slug]/playback`;
- free-live batch/session tables;
- free-live viewer/chat timing logic.

FREE LIVE remains public/standalone. Paid live remains course-owned and enrollment-gated.

## Files added/changed

Added:

- `db/migrations/016_course_audience_assignment.sql`
- `src/features/courses/repositories/postgres-course-audience.repository.ts`
- `src/features/courses/components/admin/admin-course-audience-manager.tsx`
- `src/app/api/admin/courses/[courseId]/audience/route.ts`
- `tests/course-audience-enrollment.test.mjs`
- `docs/superpowers/specs/2026-09-06-course-audience-enrollment-design.md`
- `docs/superpowers/plans/2026-09-06-course-audience-enrollment.md`
- `docs/handoff/course-audience-enrollment-2026-09-06.md`

Modified:

- `src/features/courses/domain/model.ts`
- `src/features/paid-live/repositories/postgres-paid-live.repository.ts`
- `src/app/(admin)/admin/courses/[courseId]/page.tsx`
- `src/app/(member)/dashboard/page.tsx`

A temporary feature-branch Actions workflow may exist while verification is being attempted; it must be removed before merge.

## Deployment order — important

Do not deploy the application code and then leave migration 016 unapplied. The admin course page expects `courses.assignment_mode`.

Safe order:

1. Complete code verification on the feature branch.
2. Ensure migration 016 is available to the migration runner.
3. Apply pending migration 016 to the production database.
4. Verify migration status is current.
5. Merge/deploy the application code.
6. Smoke-test admin course page and student dashboard.
7. For each existing course, explicitly choose `All active students` or `Selected students` and save.

The existing migration workflow is `.github/workflows/run-db-migrations.yml`; it checks out the selected workflow ref and runs `npm run db:status`, `npm run db:migrate`, then `npm run db:status`. Run it with confirmation value `MIGRATE` on the ref that contains migration 016.

## Verification commands

Run from repository root:

```bash
npm install --no-audit --no-fund
npm test
npm run lint
npm run build
npm run cf:build
npx wrangler deploy --dry-run --outdir .wrangler-dry-run
npx wrangler deploy --dry-run --config workers/media-delivery/wrangler.jsonc --outdir .media-worker-dry-run
npx wrangler deploy --dry-run --config workers/billing/wrangler.jsonc --outdir .billing-worker-dry-run
```

Then verify migration state:

```bash
npm run db:status
```

## Required production smoke tests

After migration + deployment:

1. Admin course page loads without database error.
2. Save one test course as Selected students with a known active student -> that student sees it, an unselected active student does not.
3. Switch that test course to All active students -> all active test students see it.
4. Activate/create a new test student after the course is All active -> new student automatically sees the published course.
5. Suspend a student -> student login/session access remains blocked by existing account controls.
6. Reactivate the student -> all-active courses are restored automatically.
7. Published paid-live session appears on the enrolled student's dashboard and course detail.
8. Unenrolled student cannot join/play that paid-live route.
9. FREE LIVE root/state/playback continue behaving exactly as before.

## Rollback notes

Application rollback is straightforward because old application code ignores `courses.assignment_mode` and the trigger only affects enrollment creation/reactivation. Do not drop migration 016 casually after it has run; forward migrations are preferred.

If the audience UI must be disabled temporarily, courses can remain `SELECTED_STUDENTS` and existing enrollments continue to be the source of access. If automatic future enrollment must be stopped without deleting history, set affected courses back to `SELECTED_STUDENTS`; the trigger then finds no matching all-active course and creates no new enrollment for those courses.
