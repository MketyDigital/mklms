-- Equivalent of PostgreSQL migration 016's student activation trigger.
-- New D1 enrollment keys are deterministic JSON-encoded tuples. Existing IDs
-- are preserved by ON CONFLICT; replication copies stored IDs verbatim.
PRAGMA foreign_keys=ON;
CREATE TRIGGER IF NOT EXISTS mklms_students_all_active_enrollment_after_insert
AFTER INSERT ON students
WHEN NEW.status='ACTIVE'
BEGIN
  INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
  SELECT lower(hex(CAST(json_array(NEW.id,c.id,'all-active') AS BLOB))),NEW.id,c.id,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  FROM courses c WHERE c.assignment_mode='ALL_ACTIVE_STUDENTS'
  ON CONFLICT(student_id,course_id) DO UPDATE SET
    status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
    activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
    updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS mklms_students_all_active_enrollment_after_status_change
AFTER UPDATE OF status ON students
WHEN NEW.status='ACTIVE' AND OLD.status IS NOT NEW.status
BEGIN
  INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
  SELECT lower(hex(CAST(json_array(NEW.id,c.id,'all-active') AS BLOB))),NEW.id,c.id,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  FROM courses c WHERE c.assignment_mode='ALL_ACTIVE_STUDENTS'
  ON CONFLICT(student_id,course_id) DO UPDATE SET
    status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
    activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
    updated_at=CURRENT_TIMESTAMP;
END;
