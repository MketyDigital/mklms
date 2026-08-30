import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { CourseStructure } from "../domain/model";
import type {
  LearningEnrollmentRecord,
  LearningProgressRepository,
} from "../services/learning-progress.service";

export class PostgresLearningRepository implements LearningProgressRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async getCourseStructure(courseId: string): Promise<CourseStructure | null> {
    const courseResult = await this.pool.query<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      status: CourseStructure["status"];
      position: number;
    }>(
      `SELECT id, slug, title, description, status, position
       FROM courses
       WHERE id = $1
       LIMIT 1`,
      [courseId],
    );

    const course = courseResult.rows[0];
    if (!course) return null;

    const moduleResult = await this.pool.query<{
      module_id: string;
      module_title: string;
      module_description: string | null;
      module_position: number;
      lesson_id: string | null;
      lesson_title: string | null;
      lesson_description: string | null;
      lesson_position: number | null;
      lesson_status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
      media_asset_id: string | null;
      completion_mode: "MANUAL" | "VIDEO_PROGRESS" | "CUSTOM" | null;
      completion_threshold_percent: number | null;
      duration_seconds: number | null;
    }>(
      `SELECT
         m.id AS module_id,
         m.title AS module_title,
         m.description AS module_description,
         m.position AS module_position,
         l.id AS lesson_id,
         l.title AS lesson_title,
         l.description AS lesson_description,
         l.position AS lesson_position,
         l.status AS lesson_status,
         l.media_asset_id,
         l.completion_mode,
         l.completion_threshold_percent,
         l.duration_seconds
       FROM course_modules m
       LEFT JOIN lessons l ON l.module_id = m.id
       WHERE m.course_id = $1
       ORDER BY m.position ASC, l.position ASC`,
      [courseId],
    );

    const modules = new Map<string, CourseStructure["modules"][number]>();

    for (const row of moduleResult.rows) {
      let module = modules.get(row.module_id);
      if (!module) {
        module = {
          id: row.module_id,
          courseId,
          title: row.module_title,
          description: row.module_description,
          position: row.module_position,
          lessons: [],
        };
        modules.set(row.module_id, module);
      }

      if (row.lesson_id && row.lesson_title && row.lesson_position !== null) {
        module.lessons.push({
          id: row.lesson_id,
          moduleId: row.module_id,
          title: row.lesson_title,
          description: row.lesson_description,
          position: row.lesson_position,
          status: row.lesson_status ?? "DRAFT",
          mediaAssetId: row.media_asset_id,
          completionMode: row.completion_mode ?? "VIDEO_PROGRESS",
          completionThresholdPercent: row.completion_threshold_percent ?? 90,
          durationSeconds: row.duration_seconds,
        });
      }
    }

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      status: course.status,
      position: course.position,
      modules: Array.from(modules.values()),
    };
  }

  async getEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<LearningEnrollmentRecord | null> {
    const result = await this.pool.query<{
      student_id: string;
      course_id: string;
      status: string;
    }>(
      `SELECT student_id, course_id, status
       FROM enrollments
       WHERE student_id = $1 AND course_id = $2
       LIMIT 1`,
      [studentId, courseId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      studentId: row.student_id,
      courseId: row.course_id,
      status: row.status,
    };
  }

  async getCompletedLessonIds(
    studentId: string,
    courseId: string,
  ): Promise<ReadonlySet<string>> {
    const result = await this.pool.query<{ lesson_id: string }>(
      `SELECT lesson_id
       FROM lesson_progress
       WHERE student_id = $1 AND course_id = $2 AND completed_at IS NOT NULL`,
      [studentId, courseId],
    );

    return new Set(result.rows.map((row) => row.lesson_id));
  }

  async saveLessonCompletion(
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO lesson_progress (
         id, student_id, course_id, lesson_id, progress_percent,
         completed_at, updated_at
       )
       VALUES ($1, $2, $3, $4, 100, NOW(), NOW())
       ON CONFLICT (student_id, lesson_id)
       DO UPDATE SET
         progress_percent = 100,
         completed_at = COALESCE(lesson_progress.completed_at, NOW()),
         updated_at = NOW()`,
      [randomUUID(), studentId, courseId, lessonId],
    );
  }

  async markEnrollmentCompleted(
    studentId: string,
    courseId: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE enrollments
       SET status = 'COMPLETED', progress_percent = 100,
           completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
       WHERE student_id = $1 AND course_id = $2`,
      [studentId, courseId],
    );
  }
}
