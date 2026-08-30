import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import type { MediaAsset } from "@/providers/media-provider";
import type {
  CreatePlaybackGrantInput,
  MediaPlaybackRepository,
} from "../services/media-playback.service";
import type {
  PlaybackGrantRecord,
  VideoProgressRepository,
} from "../services/video-progress.service";

export class PostgresMediaPlaybackRepository
  extends PostgresLearningRepository
  implements MediaPlaybackRepository, VideoProgressRepository
{
  private readonly mediaPool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    super(pool);
    this.mediaPool = pool;
  }

  async getMediaAssetForLesson(
    courseId: string,
    lessonId: string,
  ): Promise<MediaAsset | null> {
    const result = await this.mediaPool.query<{
      id: string;
      source_type: string;
      provider_asset_id: string | null;
      processing_status: string;
    }>(
      `SELECT
         media.id,
         media.source_type,
         media.provider_asset_id,
         media.processing_status
       FROM lessons lesson
       JOIN course_modules course_module ON course_module.id = lesson.module_id
       JOIN media_assets media ON media.id = lesson.media_asset_id
       WHERE lesson.id = $1
         AND course_module.course_id = $2
       LIMIT 1`,
      [lessonId, courseId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      sourceType: row.source_type,
      providerAssetId: row.provider_asset_id,
      status: row.processing_status,
    };
  }

  async createPlaybackGrant(input: CreatePlaybackGrantInput): Promise<void> {
    await this.mediaPool.query(
      `INSERT INTO media_playback_grants (
         id, student_id, course_id, lesson_id, media_asset_id,
         started_at, expires_at, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        input.id,
        input.studentId,
        input.courseId,
        input.lessonId,
        input.mediaAssetId,
        input.startedAt,
        input.expiresAt,
      ],
    );
  }

  async getPlaybackGrant(
    grantId: string,
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<PlaybackGrantRecord | null> {
    const result = await this.mediaPool.query<{
      id: string;
      student_id: string;
      course_id: string;
      lesson_id: string;
      started_at: Date;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT
         id, student_id, course_id, lesson_id,
         started_at, expires_at, revoked_at
       FROM media_playback_grants
       WHERE id = $1
         AND student_id = $2
         AND course_id = $3
         AND lesson_id = $4
       LIMIT 1`,
      [grantId, studentId, courseId, lessonId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      studentId: row.student_id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      startedAt: new Date(row.started_at),
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    };
  }

  async saveLessonProgress(
    studentId: string,
    courseId: string,
    lessonId: string,
    progressPercent: number,
    lastPositionSeconds: number,
    lessonCompleted: boolean,
  ): Promise<void> {
    await this.mediaPool.query(
      `INSERT INTO lesson_progress (
         id, student_id, course_id, lesson_id, progress_percent,
         last_position_seconds, completed_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         CASE WHEN $7::boolean THEN NOW() ELSE NULL END,
         NOW()
       )
       ON CONFLICT (student_id, lesson_id)
       DO UPDATE SET
         progress_percent = GREATEST(lesson_progress.progress_percent, EXCLUDED.progress_percent),
         last_position_seconds = GREATEST(lesson_progress.last_position_seconds, EXCLUDED.last_position_seconds),
         completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at),
         updated_at = NOW()`,
      [
        randomUUID(),
        studentId,
        courseId,
        lessonId,
        progressPercent,
        lastPositionSeconds,
        lessonCompleted,
      ],
    );
  }
}
