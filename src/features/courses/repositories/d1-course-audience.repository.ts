import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { queryD1Rows } from "../../../lib/d1-query-adapter.ts";
import type { CourseAssignmentMode } from "../domain/model";
import type { CourseAudienceState, CourseAudienceStudent } from "./postgres-course-audience.repository";

type D1Statement = ReturnType<D1DatabaseLike["prepare"]>;
type StudentRow = { id: string; display_name: string; email: string | null; phone: string | null };

async function batch(db: D1DatabaseLike, statements: D1Statement[]): Promise<void> {
  const results = await db.batch(statements);
  if (!Array.isArray(results) || results.length !== statements.length ||
    results.some((result) => !result || typeof result !== "object" || !("success" in result) || result.success !== true)) {
    throw new Error("D1 course audience transaction did not complete");
  }
}

export class D1CourseAudienceRepository {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }

  async listActiveStudents(): Promise<CourseAudienceStudent[]> {
    const rows = await queryD1Rows<StudentRow>(this.db, { sql: `SELECT id,display_name,email,phone FROM students
      WHERE status='ACTIVE' ORDER BY display_name ASC,created_at ASC,id ASC` });
    return rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, phone: row.phone }));
  }

  async getCourseAudience(courseId: string): Promise<CourseAudienceState | null> {
    const courses = await queryD1Rows<{ assignment_mode: CourseAssignmentMode }>(this.db, {
      sql: 'SELECT assignment_mode FROM courses WHERE id=? LIMIT 1', params: [courseId],
    });
    if (!courses[0]) return null;
    const enrollments = await queryD1Rows<{ student_id: string }>(this.db, {
      sql: `SELECT student_id FROM enrollments WHERE course_id=? AND status IN ('ACTIVE','COMPLETED')
        ORDER BY authorized_at ASC,student_id ASC`, params: [courseId],
    });
    return { mode: courses[0].assignment_mode, enrolledStudentIds: enrollments.map((row) => row.student_id) };
  }

  async setCourseAudience(courseId: string, mode: CourseAssignmentMode, selectedStudentIds: string[]): Promise<CourseAudienceState> {
    if (!courseId) throw new Error("Course ID required.");
    const selected = [...new Set(selectedStudentIds)];
    const statements: D1Statement[] = [this.db.prepare(`UPDATE courses SET assignment_mode=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(mode, courseId)];

    if (mode === "ALL_ACTIVE_STUDENTS") {
      statements.push(this.db.prepare(`INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
        SELECT lower(hex(CAST(json_array(s.id,c.id,'course-audience') AS BLOB))),s.id,c.id,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        FROM students s JOIN courses c ON c.id=? WHERE s.status='ACTIVE'
        ON CONFLICT(student_id,course_id) DO UPDATE SET
          status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
          activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
          updated_at=CURRENT_TIMESTAMP`).bind(courseId));
    } else {
      if (selected.length) {
        const placeholders = selected.map(() => '?').join(',');
        statements.push(this.db.prepare(`INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
          SELECT lower(hex(CAST(json_array(s.id,?,'course-audience') AS BLOB))),s.id,?,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
          FROM students s WHERE s.status='ACTIVE' AND s.id IN (${placeholders})
          ON CONFLICT(student_id,course_id) DO UPDATE SET
            status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
            activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
            updated_at=CURRENT_TIMESTAMP`).bind(courseId, courseId, ...selected));
        statements.push(this.db.prepare(`UPDATE enrollments SET status='REVOKED',updated_at=CURRENT_TIMESTAMP
          WHERE course_id=? AND status='ACTIVE' AND student_id NOT IN (${placeholders})`).bind(courseId, ...selected));
      } else {
        statements.push(this.db.prepare(`UPDATE enrollments SET status='REVOKED',updated_at=CURRENT_TIMESTAMP
          WHERE course_id=? AND status='ACTIVE'`).bind(courseId));
      }
    }

    const selectedPlaceholders = selected.map(() => '?').join(',');
    const assertionId = randomUUID();
    const assertionSql = mode === "ALL_ACTIVE_STUDENTS"
      ? `INSERT INTO mklms_d1_atomic_assertions(id,passed) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM courses WHERE id=? AND assignment_mode=?) THEN 1 ELSE 0 END)`
      : selected.length
        ? `INSERT INTO mklms_d1_atomic_assertions(id,passed) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM courses WHERE id=? AND assignment_mode=?)
          AND (SELECT COUNT(*) FROM students WHERE status='ACTIVE' AND id IN (${selectedPlaceholders}))=? THEN 1 ELSE 0 END)`
        : `INSERT INTO mklms_d1_atomic_assertions(id,passed) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM courses WHERE id=? AND assignment_mode=?) THEN 1 ELSE 0 END)`;
    const assertionParams = mode === "ALL_ACTIVE_STUDENTS" || !selected.length
      ? [assertionId, courseId, mode]
      : [assertionId, courseId, mode, ...selected, selected.length];
    statements.push(this.db.prepare(assertionSql).bind(...assertionParams));
    statements.push(this.db.prepare('DELETE FROM mklms_d1_atomic_assertions WHERE id=?').bind(assertionId));
    try {
      await batch(this.db, statements);
    } catch (error) {
      const courses = await queryD1Rows<{ id: string }>(this.db, { sql: 'SELECT id FROM courses WHERE id=? LIMIT 1', params: [courseId] });
      if (!courses[0]) throw new Error("Course not found.");
      if (mode === "SELECTED_STUDENTS" && selected.length) {
        const count = await queryD1Rows<{ n: number }>(this.db, {
          sql: `SELECT COUNT(*) AS n FROM students WHERE status='ACTIVE' AND id IN (${selectedPlaceholders})`, params: selected,
        });
        if (count[0]?.n !== selected.length) throw new Error("One or more selected students are not active.");
      }
      throw error;
    }

    const result = await this.getCourseAudience(courseId);
    if (!result) throw new Error("Course not found.");
    return result;
  }
}
