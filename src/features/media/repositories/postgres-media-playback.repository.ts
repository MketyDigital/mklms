import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import type { MediaAsset } from "@/providers/media-provider";
import type {
  CreatePlaybackGrantInput,
  MediaPlaybackRepository,
} from "../services/media-playback.service";

export class PostgresMediaPlaybackRepository
  extends PostgresLearningRepository
  implements MediaPlaybackRepository
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
      status: row.processing_status === "READY" ? "READY" : row.processing_status,
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
}
