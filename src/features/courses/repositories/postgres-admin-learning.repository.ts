import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type {
  CourseModuleRecord,
  CourseRecord,
  CourseStatus,
  LessonRecord,
  LessonStatus,
} from "../domain/model";
import type { AdminLearningRepository } from "../services/admin-learning.service";

export class PostgresAdminLearningRepository implements AdminLearningRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async listCourses(): Promise<CourseRecord[]> {
    const result = await this.pool.query<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      status: CourseStatus;
      position: number;
    }>(
      `SELECT id, slug, title, description, status, position
       FROM courses
       ORDER BY position ASC, created_at ASC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: row.status,
      position: row.position,
    }));
  }

  async createCourse(
    input: Omit<CourseRecord, "id" | "position" | "status"> & {
      status?: CourseStatus;
    },
  ): Promise<CourseRecord> {
    const result = await this.pool.query<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      status: CourseStatus;
      position: number;
    }>(
      `INSERT INTO courses (id, slug, title, description, status, position)
       VALUES (
         $1, $2, $3, $4, $5,
         COALESCE((SELECT MAX(position) + 1 FROM courses), 1)
       )
       RETURNING id, slug, title, description, status, position`,
      [
        randomUUID(),
        input.slug,
        input.title,
        input.description ?? null,
        input.status ?? "DRAFT",
      ],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: row.status,
      position: row.position,
    };
  }

  async createModule(
    courseId: string,
    input: Omit<CourseModuleRecord, "id" | "courseId" | "position">,
  ): Promise<CourseModuleRecord> {
    const result = await this.pool.query<{
      id: string;
      course_id: string;
      title: string;
      description: string | null;
      position: number;
    }>(
      `INSERT INTO course_modules (id, course_id, title, description, position)
       VALUES (
         $1, $2, $3, $4,
         COALESCE((SELECT MAX(position) + 1 FROM course_modules WHERE course_id = $2), 1)
       )
       RETURNING id, course_id, title, description, position`,
      [randomUUID(), courseId, input.title, input.description ?? null],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      description: row.description,
      position: row.position,
    };
  }

  async createLesson(
    moduleId: string,
    input: Omit<LessonRecord, "id" | "moduleId" | "position" | "status">,
  ): Promise<LessonRecord> {
    const result = await this.pool.query<{
      id: string;
      module_id: string;
      title: string;
      description: string | null;
      position: number;
      status: LessonRecord["status"];
      media_asset_id: string | null;
      completion_mode: LessonRecord["completionMode"];
      completion_threshold_percent: number;
      duration_seconds: number | null;
    }>(
      `INSERT INTO lessons (
         id, module_id, title, description, position, status,
         media_asset_id, completion_mode, completion_threshold_percent,
         duration_seconds
       )
       VALUES (
         $1, $2, $3, $4,
         COALESCE((SELECT MAX(position) + 1 FROM lessons WHERE module_id = $2), 1),
         'DRAFT', $5, $6, $7, $8
       )
       RETURNING id, module_id, title, description, position, status,
                 media_asset_id, completion_mode, completion_threshold_percent,
                 duration_seconds`,
      [
        randomUUID(),
        moduleId,
        input.title,
        input.description ?? null,
        input.mediaAssetId ?? null,
        input.completionMode,
        input.completionThresholdPercent,
        input.durationSeconds ?? null,
      ],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      moduleId: row.module_id,
      title: row.title,
      description: row.description,
      position: row.position,
      status: row.status,
      mediaAssetId: row.media_asset_id,
      completionMode: row.completion_mode,
      completionThresholdPercent: row.completion_threshold_percent,
      durationSeconds: row.duration_seconds,
    };
  }

  async setCourseStatus(courseId: string, status: CourseStatus): Promise<void> {
    await this.pool.query(
      `UPDATE courses SET status = $2, updated_at = NOW() WHERE id = $1`,
      [courseId, status],
    );
  }

  async setLessonStatus(lessonId: string, status: LessonStatus): Promise<void> {
    await this.pool.query(
      `UPDATE lessons SET status = $2, updated_at = NOW() WHERE id = $1`,
      [lessonId, status],
    );
  }
}
