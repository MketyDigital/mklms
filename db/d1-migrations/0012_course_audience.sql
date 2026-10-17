-- SQLite audience-assignment schema. PostgreSQL 016 creates enrollments using
-- md5(student_id || ':' || course_id || ':all-active') and serializes activation.
-- SQLite has no native MD5 or pg_advisory_xact_lock. Do NOT introduce a
-- different ID generation algorithm in a D1 trigger: doing so breaks failback.
-- D1 activation must be implemented by a transactional application service
-- with the same deterministic ID contract and tested concurrency semantics.
PRAGMA foreign_keys=ON;
ALTER TABLE courses ADD COLUMN assignment_mode TEXT NOT NULL DEFAULT 'SELECTED_STUDENTS'
 CHECK(assignment_mode IN ('SELECTED_STUDENTS','ALL_ACTIVE_STUDENTS'));
CREATE INDEX IF NOT EXISTS courses_assignment_mode_status_idx ON courses(assignment_mode,status);
