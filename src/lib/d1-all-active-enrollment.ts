import { allActiveEnrollmentId } from "./all-active-enrollment-id.ts";
import type { D1DatabaseLike } from "./d1-query-adapter.ts";
import { executeD1 } from "./d1-query-adapter.ts";

/**
 * Atomically enroll an active student in a single ALL_ACTIVE_STUDENTS course.
 * The INSERT SELECT predicate and ON CONFLICT update run as one D1 statement.
 * The caller must enumerate eligible courses from the same authoritative
 * database, coordinate membership changes and handle replay/checkpointing.
 * This is a building block, not the full cross-course enrollment transaction.
 */
export async function activateD1AllActiveCourse(
  db: D1DatabaseLike, studentId: string, courseId: string,
): Promise<number> {
  const enrollmentId = allActiveEnrollmentId(studentId, courseId);
  return executeD1(db, {
    sql: `INSERT INTO enrollments
      (id,student_id,course_id,status,authorized_at,activated_at)
      SELECT ?,s.id,c.id,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      FROM students s JOIN courses c ON c.id=?
      WHERE s.id=? AND s.status='ACTIVE'
        AND c.assignment_mode='ALL_ACTIVE_STUDENTS'
      ON CONFLICT(student_id,course_id) DO UPDATE SET
        status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
        activated_at=CASE WHEN enrollments.status='COMPLETED'
          THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
        updated_at=CURRENT_TIMESTAMP`,
    params: [enrollmentId,courseId,studentId],
  });
}
