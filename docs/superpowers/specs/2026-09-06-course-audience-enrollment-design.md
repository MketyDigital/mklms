# Course Audience, Enrollment, and Paid Live Visibility Design

## Goal
Ensure published paid courses reliably appear to the correct students, give admins explicit course-audience controls, automatically enroll current and future active students when a course targets everyone, and surface paid-live sessions in the correct member areas without changing FREE LIVE.

## Root cause found
The student dashboard derives course visibility only from `enrollments`. Publishing a course does not create enrollment rows. Admin access/preauthorization can assign one course during claim, but there is no course-level audience control for existing students and no persistent rule for future students. The dashboard's member-live card is placeholder copy rather than real paid-live data.

## Course assignment modes
Each course has one of two modes:

- `SELECTED_STUDENTS` (default): only explicitly enrolled active/completed students see the course. Admin can select active students for the course. Saving the selection activates checked students and revokes unchecked ACTIVE enrollments. COMPLETED enrollments are preserved so historical learning/certificates are not destroyed.
- `ALL_ACTIVE_STUDENTS`: all currently ACTIVE students are enrolled immediately. Any student who later becomes ACTIVE, through first-time creation or later reactivation, is automatically enrolled. Existing COMPLETED enrollments remain completed.

Changing a course back from `ALL_ACTIVE_STUDENTS` to `SELECTED_STUDENTS` does not silently erase historical completion. The admin saves the selected active set, which controls ACTIVE enrollments.

## Data model
Migration 016 adds `courses.assignment_mode` with a check constraint and a safe default of `SELECTED_STUDENTS`. No existing course is automatically exposed merely by applying the migration.

Existing `enrollments` remains the source of truth for actual student access. No duplicate assignment table is introduced.

Migration 016 also installs an `AFTER INSERT OR UPDATE OF status` trigger on `students`. When a row becomes `ACTIVE`, the trigger inserts that student into every course whose assignment mode is `ALL_ACTIVE_STUDENTS`. The trigger runs inside the database transaction that creates/reactivates the student, uses `ON CONFLICT (student_id, course_id)`, preserves `COMPLETED` enrollment state, and therefore applies consistently to both current and future activation pathways.

## Admin behavior
The course-builder page gains a Course audience section showing:

- All active students
- Selected students
- Complete active-student checklist with current active enrollment state
- Select all / Clear all
- Save action and clear explanatory text

The API validates admin session, assignment mode, student IDs, and active-student status and uses the existing admin rate limiter. `ALL_ACTIVE_STUDENTS` bulk-enrolls every active student transactionally with one `INSERT ... SELECT ... ON CONFLICT`. `SELECTED_STUDENTS` activates checked students and revokes unchecked ACTIVE enrollments for that course while preserving COMPLETED rows and their learning/certificate history.

## New-student auto enrollment
Future enrollment is enforced by the database trigger rather than by one particular application route. This is deliberate: any existing or future application path that inserts a student as ACTIVE or changes a student's status back to ACTIVE receives the same rule atomically. The existing verified-claim/preauthorization logic remains unchanged and can still assign its explicitly selected course. Unique `(student_id, course_id)` enrollment protection keeps both mechanisms idempotent.

## Student dashboard and courses
`StudentLearningService.listMyCourses()` continues to expose only ACTIVE/COMPLETED enrollments and only published courses. The assignment feature fixes missing enrollments at the source rather than bypassing access checks.

The dashboard additionally loads published paid-live sessions belonging to the student's ACTIVE/COMPLETED enrolled, published courses. Upcoming and currently live sessions are rendered as real cards linking to the existing enrollment-gated paid-live route. Ended sessions remain accessible from the course detail if still published but are not promoted on the dashboard.

Course detail keeps its existing Paid live sessions section. Zoom join and protected-video playback routes independently re-check session/course publication and ACTIVE/COMPLETED course enrollment before granting access.

## FREE LIVE isolation
No `/live/[slug]`, `/api/live/[slug]/state`, `/api/live/[slug]/playback`, free-live tables, or free-live service behavior is changed. Public FREE LIVE remains a different subsystem.

## Safety and history
- Default migration behavior exposes no existing course to extra students.
- COMPLETED enrollments are never revoked by audience synchronization or student reactivation.
- Revoked ACTIVE course access retains lesson progress/history and can be restored by selecting the student again.
- Student suspension/reactivation keeps using the existing account-status controls; reactivation automatically restores all courses currently configured for all active students.
- No certificate, lesson progress, quiz attempt, media, R2, Hyperdrive, DNS, SSL, Worker-secret, Cloudflare routing, FREE LIVE, or billing behavior changes.
- Assignment changes are transactional and idempotent.

## Deployment order
Migration 016 must be applied before relying on the new admin audience UI/API. Because the admin page reads `courses.assignment_mode`, production deployment should apply migration 016 before or immediately with the application release. The safest release sequence is: verify branch -> make migration 016 available to the migration runner -> apply migration 016 -> deploy the application code -> choose the desired audience for each existing course.

## Verification
Tests must prove migration safety, activation trigger behavior, all-active bulk enrollment, selected-student synchronization, completed-history preservation, admin API security/rate limiting, dashboard paid-live visibility, paid-live server authorization, published/enrollment filtering, and FREE LIVE isolation. Full tests, lint, Next build, OpenNext build, and all Worker packaging dry-runs must pass before merge.