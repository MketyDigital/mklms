-- Replay must not re-run source-derived effects such as automatic enrollments.
-- The applier enables this flag only inside one atomic target batch and must
-- keep source capture disabled on the standby. Integrity guards remain active.
ALTER TABLE mklms_replication_config
  ADD COLUMN apply_in_progress INTEGER NOT NULL DEFAULT 0
  CHECK (apply_in_progress IN (0, 1));

DROP TRIGGER mklms_students_all_active_enrollment_after_insert;
DROP TRIGGER mklms_students_all_active_enrollment_after_status_change;

CREATE TRIGGER mklms_students_all_active_enrollment_after_insert
AFTER INSERT ON students
WHEN NEW.status='ACTIVE'
 AND COALESCE((SELECT apply_in_progress FROM mklms_replication_config WHERE singleton=1),0)=0
BEGIN
  INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
  SELECT lower(hex(CAST(json_array(NEW.id,c.id,'all-active') AS BLOB))),NEW.id,c.id,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  FROM courses c WHERE c.assignment_mode='ALL_ACTIVE_STUDENTS'
  ON CONFLICT(student_id,course_id) DO UPDATE SET
    status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
    activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
    updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER mklms_students_all_active_enrollment_after_status_change
AFTER UPDATE OF status ON students
WHEN NEW.status='ACTIVE' AND OLD.status IS NOT NEW.status
 AND COALESCE((SELECT apply_in_progress FROM mklms_replication_config WHERE singleton=1),0)=0
BEGIN
  INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
  SELECT lower(hex(CAST(json_array(NEW.id,c.id,'all-active') AS BLOB))),NEW.id,c.id,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  FROM courses c WHERE c.assignment_mode='ALL_ACTIVE_STUDENTS'
  ON CONFLICT(student_id,course_id) DO UPDATE SET
    status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
    activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
    updated_at=CURRENT_TIMESTAMP;
END;
