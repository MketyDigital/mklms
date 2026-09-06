# MkLMS Course Audience / Enrollment / Paid Live Handoff — 2026-09-06

## Problem and root cause
Active students could see no course because every member surface (`/dashboard`, `/courses`, `/progress`) ultimately reads `enrollments`. Publishing a course did not create enrollment rows. Admin preauthorization could assign one course during claim, but there was no course-level audience control for existing students and no persistent rule for future students. The dashboard also had only placeholder copy for member paid-live sessions.

## Final access model
`enrollments` remains the single source of truth for paid-course access. This feature does not make a published course globally readable and does not weaken any student, lesson, quiz, media, or paid-live authorization check.

Every course has an `assignment_mode`:
- `SELECTED_STUDENTS` — safe default. Admin explicitly chooses active students. COMPLETED enrollment/history is preserved.
- `ALL_ACTIVE_STUDENTS` — all current ACTIVE students are enrolled immediately; every student who later becomes ACTIVE is enrolled automatically.

FREE LIVE remains a separate public webinar subsystem.

## Migration 016
New file: `db/migrations/016_course_audience_assignment.sql`.

It adds `courses.assignment_mode TEXT NOT NULL DEFAULT 'SELECTED_STUDENTS'`, a table-scoped check constraint for the two modes, and an `(assignment_mode, status)` index.

It also creates `mklms_enroll_active_student_in_all_courses()` and trigger `mklms_students_all_active_course_enrollment` (`AFTER INSERT OR UPDATE OF status ON students`). The trigger:
- exits unless `NEW.status = ACTIVE`;
- on UPDATE, exits if status did not actually change;
- never references `OLD` for an INSERT event;
- inserts the student into every `ALL_ACTIVE_STUDENTS` course with `ON CONFLICT (student_id, course_id)`;
- preserves `COMPLETED` enrollment state instead of resetting it.

This database-level rule intentionally covers first-time student creation, admin reactivation, and future application paths that make a student ACTIVE.

## Current-student assignment
New repository: `src/features/courses/repositories/postgres-course-audience.repository.ts`.

It provides:
- `listActiveStudents()` — complete ACTIVE population, without the generic member-list cap;
- `getCourseAudience(courseId)`;
- `setCourseAudience(courseId, mode, selectedStudentIds)`.

`ALL_ACTIVE_STUDENTS` uses a single bulk `INSERT ... SELECT ... ON CONFLICT` for current active students.

`SELECTED_STUDENTS`:
- deduplicates submitted IDs;
- accepts only currently ACTIVE student accounts;
- bulk inserts/reactivates selected students;
- changes only unchecked ACTIVE course enrollments to `REVOKED`;
- never revokes `COMPLETED` enrollment rows;
- does not delete progress, quizzes, certificates, or history.

## Admin API and UI
New API: `PATCH /api/admin/courses/[courseId]/audience`.

Protection:
- valid admin session;
- Zod input validation;
- existing `ADMIN_RATE_LIMITER`;
- transaction rollback on failure;
- known validation/not-found errors only; unexpected database errors are logged server-side and returned as a generic 500.

New UI: `src/features/courses/components/admin/admin-course-audience-manager.tsx`, rendered at the top of `/admin/courses/[courseId]`.

Admin can choose:
1. **All active students** — explicitly states current + future active students are included.
2. **Selected students** — complete active-student checkbox list with search by name/email/phone and Select all / Clear all.

The UI keeps saved selected state scoped to currently active students, avoiding hidden suspended/completed IDs being accidentally resubmitted.

## Existing courses after migration
Migration 016 deliberately defaults existing courses to `SELECTED_STUDENTS`. Applying the migration alone does not expose courses to everyone.

For an existing course that everybody should see:
1. Admin -> Courses -> open course.
2. Course audience -> **All active students**.
3. **Save course audience**.

All current ACTIVE students are enrolled immediately. Future ACTIVE students are then enrolled automatically by the trigger.

For a restricted course, choose **Selected students**, search/check the intended active students, and save.

## Pre-existing completed-enrollment bug fixed during audit
`src/features/access/repositories/postgres-access.repository.ts` had two older enrollment-upsert paths that used `DO UPDATE SET status = 'ACTIVE'`. Reassigning/preauthorizing a student to a course they had already completed could therefore downgrade `COMPLETED` to `ACTIVE`.

Both `activateEnrollment()` and the transactional `completeVerifiedClaim()` course upsert now preserve `COMPLETED` status and its original activation time. This aligns legacy enrollment paths with the new audience system and protects completion/certificate history.

## Member course surfaces
`StudentLearningService.listMyCourses()` is intentionally unchanged: it still requires a real ACTIVE/COMPLETED enrollment and a PUBLISHED course.

Therefore the same corrected enrollment data automatically fixes:
- `/dashboard`;
- `/courses`;
- `/progress`;
- direct course view authorization.

There is no dashboard-only bypass.

## Paid-live dashboard visibility
`PostgresPaidLiveRepository.listForStudent(studentId)` now returns only sessions where:
- student enrollment is ACTIVE or COMPLETED;
- course is PUBLISHED;
- paid-live session is PUBLISHED;
- session has not ended, unless a future caller explicitly requests ended sessions.

`/dashboard` now shows real **Member live sessions** cards with course title, session title, UPCOMING/LIVE state, schedule, and `/courses/{courseId}/live/{sessionId}` link.

The existing course-detail **Paid live sessions** section remains in place.

## Paid-live authorization audit
Dashboard visibility does not grant access.

Existing Zoom join endpoint still independently requires authenticated student, matching course/session, PUBLISHED course/session, ACTIVE/COMPLETED enrollment, LIVE time window, and valid Zoom URL.

Existing protected-video playback endpoint still independently requires authenticated student, PUBLISHED course/session, ACTIVE/COMPLETED enrollment, allowed managed-hosting state, LIVE time window, READY protected media, and a short-lived playback authorization.

## FREE LIVE isolation
No FREE LIVE file or behavior is modified. In particular this feature does not change:
- `/live/[slug]`;
- `/api/live/[slug]/state`;
- `/api/live/[slug]/playback`;
- free-live batch/session tables;
- public viewer/chat/playback timing.

FREE LIVE stays public/standalone. Paid live stays course-owned/enrollment-gated.

## Files added
- `db/migrations/016_course_audience_assignment.sql`
- `src/features/courses/repositories/postgres-course-audience.repository.ts`
- `src/features/courses/components/admin/admin-course-audience-manager.tsx`
- `src/app/api/admin/courses/[courseId]/audience/route.ts`
- `tests/course-audience-enrollment.test.mjs`
- `docs/superpowers/specs/2026-09-06-course-audience-enrollment-design.md`
- `docs/superpowers/plans/2026-09-06-course-audience-enrollment.md`
- `docs/handoff/course-audience-enrollment-2026-09-06.md`

## Files modified
- `src/features/access/repositories/postgres-access.repository.ts`
- `src/features/courses/domain/model.ts`
- `src/features/paid-live/repositories/postgres-paid-live.repository.ts`
- `src/app/(admin)/admin/courses/[courseId]/page.tsx`
- `src/app/(member)/dashboard/page.tsx`

No DNS, SSL, Cloudflare Worker route, Worker secret, R2, Hyperdrive, billing, or FREE LIVE file is changed. The temporary branch verification workflow was removed before merge-readiness review.

## Deployment order — mandatory
Do not deploy the new admin application code while leaving migration 016 unapplied because the course admin page reads `courses.assignment_mode`.

Safe order:
1. Run the full verification commands below on a working runner/local checkout.
2. Make migration 016 available to the production migration runner.
3. Run `.github/workflows/run-db-migrations.yml` on the ref containing migration 016 with input `MIGRATE`.
4. Confirm `npm run db:status` is current.
5. Merge/deploy the application code.
6. Smoke-test admin and student surfaces.
7. Explicitly choose an audience for each existing course.

The migration workflow itself runs `db:status -> db:migrate -> db:status` and uses the protected migration database secrets.

## Verification commands
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

Then:
```bash
npm run db:status
```

## Verification status at handoff
GitHub Actions is currently failing before job step 1 for both the normal PR workflow and the temporary minimal workflow. The failed runs contain no executed steps/log body. This is a runner/platform execution failure, not a test assertion/build failure, but it also means this branch must **not** be described as fully runtime-verified yet.

Do not merge solely on the static audit. Run the commands above on a functioning runner or local checkout first.

## Required production smoke test
After migration + deployment:
1. Admin course page loads.
2. Selected mode: selected active student sees published course; unselected active student does not.
3. All-active mode: all current active test students see published course.
4. Create/activate a new test student after all-active is saved: course appears automatically.
5. Suspend student: existing account controls block access.
6. Reactivate student: all-active courses are restored automatically.
7. Paid live appears on dashboard and inside the enrolled course.
8. Unenrolled student cannot join/play the paid live route.
9. `/courses` and `/progress` agree with dashboard course visibility.
10. FREE LIVE state/playback behaves exactly as before.

## Rollback
Prefer forward fixes; do not casually edit/drop an applied migration.

If automatic future assignment must be stopped, set affected courses to `SELECTED_STUDENTS`. The trigger then has no matching all-active course and creates no new enrollment for it. Existing course/progress/certificate history remains intact.
