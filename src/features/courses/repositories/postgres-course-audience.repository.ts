import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { getPostgresPool } from "@/lib/postgres";

export type CourseAssignmentMode = "SELECTED_STUDENTS" | "ALL_ACTIVE_STUDENTS";

export type CourseAudienceState = {
  mode: CourseAssignmentMode;
  enrolledStudentIds: string[];
};

async function activateEnrollment(
  client: PoolClient,
  studentId: string,
  courseId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO enrollments (
       id, student_id, course_id, status, authorized_at, activated_at
     )
     VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
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
    [randomUUID(), studentId, courseId],
  );
}

export class PostgresCourseAudienceRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
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
        const activeStudents = await client.query<{ id: string }>(
          `SELECT id
           FROM students
           WHERE status = 'ACTIVE'
           ORDER BY created_at ASC, id ASC`,
        );
        for (const student of activeStudents.rows) {
          await activateEnrollment(client, student.id, courseId);
        }
      } else {
        const uniqueIds = Array.from(new Set(selectedStudentIds));
        if (uniqueIds.length) {
          const activeStudents = await client.query<{ id: string }>(
            `SELECT id
             FROM students
             WHERE status = 'ACTIVE'
               AND id = ANY($1::text[])`,
            [uniqueIds],
          );
          if (activeStudents.rows.length !== uniqueIds.length) {
            throw new Error("One or more selected students are not active.");
          }
          for (const student of activeStudents.rows) {
            await activateEnrollment(client, student.id, courseId);
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
