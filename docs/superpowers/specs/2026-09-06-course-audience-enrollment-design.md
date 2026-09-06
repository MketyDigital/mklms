# Course Audience, Enrollment, and Paid Live Visibility Design

## Goal
Ensure published paid courses reliably appear to the correct students, give admins explicit course-audience controls, automatically enroll current and future active students when a course targets everyone, and surface paid-live sessions in the correct member areas without changing FREE LIVE.

## Root cause found
The student dashboard derives course visibility only from `enrollments`. Publishing a course does not create enrollment rows. Admin access/preauthorization can assign one course during claim, but there is no course-level audience control for existing students and no persistent rule for future students. The dashboard's member-live card is placeholder copy rather than real paid-live data.

## Course assignment modes
Each course has one of two modes:

- `SELECTED_STUDENTS` (default): only explicitly enrolled active/completed students see the course. Admin can select active students for the course. Saving the selection activates checked students and revokes unchecked ACTIVE enrollments. COMPLETED enrollments are preserved so historical learning/certificates are not destroyed.
- `ALL_ACTIVE_STUDENTS`: all currently ACTIVE students are enrolled immediately. Any student who later becomes ACTIVE through the normal verified-claim flow is also enrolled automatically. Existing COMPLETED enrollments remain completed.

Changing a course back from `ALL_ACTIVE_STUDENTS` to `SELECTED_STUDENTS` does not silently erase historical completion. The admin saves the selected active set, which controls ACTIVE enrollments.

## Data model
Migration 016 adds `courses.assignment_mode` with a check constraint and a safe default of `SELECTED_STUDENTS`. No existing course is automatically exposed merely by applying the migration.

Existing `enrollments` remains the source of truth for actual student access. No duplicate assignment table is introduced.

## Admin behavior
The course-builder page gains a Course audience section showing:

- All active students
- Selected students
- Active student checklist with current enrollment state
- Save action and clear explanatory text

The API validates admin session, course existence, student IDs, and active-student status. `ALL_ACTIVE_STUDENTS` bulk-enrolls every active student transactionally. `SELECTED_STUDENTS` activates checked students and revokes unchecked ACTIVE enrollments for that course while preserving COMPLETED rows.

## New-student auto enrollment
The existing transactional verified-claim path remains authoritative for creating/activating student access. Before commit, it additionally inserts ACTIVE enrollments for every course whose assignment mode is `ALL_ACTIVE_STUDENTS`. The specifically preauthorized course is still enrolled exactly as before. `ON CONFLICT` keeps this idempotent and does not duplicate rows.

## Student dashboard and courses
`StudentLearningService.listMyCourses()` continues to expose only ACTIVE/COMPLETED enrollments and only published courses. The assignment feature fixes missing enrollments at the source rather than bypassing access checks.

The dashboard additionally loads published paid-live sessions belonging to the student's ACTIVE/COMPLETED enrolled, published courses. Upcoming and currently live sessions are rendered as real cards linking to the existing enrollment-gated paid-live route. Ended sessions remain accessible from the course detail if still published but are not promoted on the dashboard.

Course detail keeps its existing Paid live sessions section. Join/playback routes remain enrollment gated.

## FREE LIVE isolation
No `/live/[slug]`, `/api/live/[slug]/state`, `/api/live/[slug]/playback`, free-live tables, or free-live service behavior is changed. Public FREE LIVE remains a different subsystem.

## Safety and history
- Default migration behavior exposes no existing course to extra students.
- COMPLETED enrollments are never revoked by audience synchronization.
- No certificate, lesson progress, quiz attempt, media, R2, Hyperdrive, DNS, SSL, Worker-secret, or Cloudflare routing behavior changes.
- Assignment changes are idempotent.

## Verification
Tests must prove migration safety, all-active bulk enrollment, selected-student synchronization, automatic enrollment of newly activated students, dashboard paid-live visibility, published/enrollment filtering, and FREE LIVE isolation. Full tests, lint, Next build, OpenNext build, and all Worker packaging dry-runs must pass before merge.