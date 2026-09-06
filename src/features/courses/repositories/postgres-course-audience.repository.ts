import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { CourseAssignmentMode } from "../domain/model";

export type CourseAudienceState = {
  mode: CourseAssignmentMode;
  enrolledStudentIds: string[];
};

export type CourseAudienceStudent = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
};

export class PostgresCourseAudienceRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async listActiveStudents(): Promise<CourseAudienceStudent[]> {
    const result = await this.pool.query<{
      id: string;
      display_name: string;
      email: string | null;
      phone: string | null;
    }>(
      `SELECT id, display_name, email, phone
       FROM students
       WHERE status = 'ACTIVE'
       ORDER BY display_name ASC, created_at ASC, id ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
    }));
  }

  async getCourseAudience(courseId: string): Promise<CourseAudienceState | null> {
    const course = await this.pool.query<{ assignment_mode: CourseAssignmentMode }>(
      `SELECT assignment_mode
       FROM courses
       WHERE id = $1
       LIMIT 1`,
      [courseId],
    );
    if (!course.rows[0]) return null;

    const enrollments = await this.pool.query<{ student_id: string }>(
      `SELECT student_id
       FROM enrollments
       WHERE course_id = $1
         AND status IN ('ACTIVE', 'COMPLETED')
       ORDER BY authorized_at ASC, student_id ASC`,
      [courseId],
    );

    return {
      mode: course.rows[0].assignment_mode,
      enrolledStudentIds: enrollments.rows.map((row) => row.student_id),
    };
  }

  async setCourseAudience(
    courseId: string,
    mode: CourseAssignmentMode,
    selectedStudentIds: string[],
  ): Promise<CourseAudienceState> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(764551001)");

      const course = await client.query<{ id: string }>(
        `SELECT id FROM courses WHERE id = $1 FOR UPDATE`,
        [courseId],
      );
      if (!course.rows[0]) throw new Error("Course not found.");

      await client.query(
        `UPDATE courses
         SET assignment_mode = $2, updated_at = NOW()
         WHERE id = $1`,
        [courseId, mode],
      );

      if (mode === "ALL_ACTIVE_STUDENTS") {
        await client.query(
          `INSERT INTO enrollments (
             id, student_id, course_id, status, authorized_at, activated_at
           )
           SELECT
             md5(student.id || ':' || $1 || ':course-audience'),
             student.id,
             $1,
             'ACTIVE',
             NOW(),
             NOW()
           FROM students student
           WHERE student.status = 'ACTIVE'
           ON CONFLICT (student_id, course_id)
           DO UPDATE SET
             status = CASE
               WHEN enrollments.status = 'COMPLETED' THEN 'COMPLETED'
               ELSE 'ACTIVE'
             END,
             activated_at = CASE
               WHEN enrollments.status = 'COMPLETED' THEN enrollments.activated_at
               ELSE NOW()
             END,
             updated_at = NOW()`,
          [courseId],
        );
      } else {
        const uniqueIds = Array.from(new Set(selectedStudentIds));
        if (uniqueIds.length) {
          const activated = await client.query<{ student_id: string }>(
            `INSERT INTO enrollments (
               id, student_id, course_id, status, authorized_at, activated_at
             )
             SELECT
               md5(student.id || ':' || $1 || ':course-audience'),
               student.id,
               $1,
               'ACTIVE',
               NOW(),
               NOW()
             FROM students student
             WHERE student.status = 'ACTIVE'
               AND student.id = ANY($2::text[])
             ON CONFLICT (student_id, course_id)
             DO UPDATE SET
               status = CASE
                 WHEN enrollments.status = 'COMPLETED' THEN 'COMPLETED'
                 ELSE 'ACTIVE'
               END,
               activated_at = CASE
                 WHEN enrollments.status = 'COMPLETED' THEN enrollments.activated_at
                 ELSE NOW()
               END,
               updated_at = NOW()
             RETURNING student_id`,
            [courseId, uniqueIds],
          );
          if (activated.rows.length !== uniqueIds.length) {
            throw new Error("One or more selected students are not active.");
          }
        }

        await client.query(
          `UPDATE enrollments
           SET status = 'REVOKED', updated_at = NOW()
           WHERE course_id = $1
             AND status = 'ACTIVE'
             AND NOT (student_id = ANY($2::text[]))`,
          [courseId, uniqueIds],
        );
      }

      const enrolled = await client.query<{ student_id: string }>(
        `SELECT student_id
         FROM enrollments
         WHERE course_id = $1
           AND status IN ('ACTIVE', 'COMPLETED')
         ORDER BY authorized_at ASC, student_id ASC`,
        [courseId],
      );

      await client.query("COMMIT");
      return {
        mode,
        enrolledStudentIds: enrolled.rows.map((row) => row.student_id),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
