-- D1 port of PostgreSQL 016 audience assignment, including automatic
-- enrollments on student creation and activation. UUID-equivalent generated
-- IDs use 32 lower-case hex characters. Must be verified against PG MD5 IDs
-- and concurrency semantics before any production cutover.
PRAGMA foreign_keys=ON;
ALTER TABLE courses ADD COLUMN assignment_mode TEXT NOT NULL DEFAULT 'SELECTED_STUDENTS'
 CHECK(assignment_mode IN ('SELECTED_STUDENTS','ALL_ACTIVE_STUDENTS'));
CREATE INDEX IF NOT EXISTS courses_assignment_mode_status_idx ON courses(assignment_mode,status);
CREATE TRIGGER IF NOT EXISTS mklms_students_all_active_insert
AFTER INSERT ON students WHEN NEW.status='ACTIVE'
BEGIN
 INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
 SELECT lower(hex(NEW.id || ':' || c.id || ':all-active')), NEW.id, c.id,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
 FROM courses c WHERE c.assignment_mode='ALL_ACTIVE_STUDENTS'
 ON CONFLICT(student_id,course_id) DO UPDATE SET
 status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
 activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
 updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS mklms_students_all_active_activate
AFTER UPDATE OF status ON students WHEN NEW.status='ACTIVE' AND OLD.status IS NOT NEW.status
BEGIN
 INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
 SELECT lower(hex(NEW.id || ':' || c.id || ':all-active')), NEW.id,c.id,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
 FROM courses c WHERE c.assignment_mode='ALL_ACTIVE_STUDENTS'
 ON CONFLICT(student_id,course_id) DO UPDATE SET
 status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
 activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
 updated_at=CURRENT_TIMESTAMP;
END;
