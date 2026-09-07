import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import type {
  PlaybackGrantRecord,
  VideoProgressRepository,
} from "../services/video-progress.service";

export class PostgresVideoProgressRepository
  extends PostgresLearningRepository
  implements VideoProgressRepository
{
  private readonly mediaPool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    super(pool);
    this.mediaPool = pool;
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
      `SELECT id, student_id, course_id, lesson_id,
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

  async getCreditedWatchSecondsExcludingGrant(
    studentId: string,
    courseId: string,
    lessonId: string,
    grantId: string,
  ): Promise<number> {
    const result = await this.mediaPool.query<{ credited_seconds: string }>(
      `SELECT COALESCE(SUM(credited_seconds), 0)::text AS credited_seconds
       FROM media_watch_credits
       WHERE student_id = $1
         AND course_id = $2
         AND lesson_id = $3
         AND grant_id <> $4`,
      [studentId, courseId, lessonId, grantId],
    );
    return Math.max(0, Number(result.rows[0]?.credited_seconds ?? 0) || 0);
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
         id, student_id, course_id, lesson_id,
         progress_percent, last_position_seconds,
         completed_at, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         CASE WHEN $7::boolean THEN NOW() ELSE NULL END,
         NOW(), NOW()
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

  async recordCreditedWatch(
    grantId: string,
    studentId: string,
    courseId: string,
    lessonId: string,
    creditedSeconds: number,
  ): Promise<void> {
    await this.mediaPool.query(
      `INSERT INTO media_watch_credits (
         grant_id, student_id, course_id, lesson_id,
         credited_seconds, first_credited_at, last_credited_at
       )
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (grant_id)
       DO UPDATE SET
         credited_seconds = GREATEST(media_watch_credits.credited_seconds, EXCLUDED.credited_seconds),
         last_credited_at = NOW()`,
      [
        grantId,
        studentId,
        courseId,
        lessonId,
        Math.max(0, Math.floor(creditedSeconds)),
      ],
    );
  }
}
