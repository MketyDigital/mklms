import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { MediaAsset } from "@/providers/media-provider";
import type { PaidCourseLiveSession, PaidLiveStatus } from "../domain/model";

function mapSession(row: {
  id: string; course_id: string; media_asset_id: string | null; title: string;
  description: string | null; starts_at: Date; ends_at: Date; status: PaidLiveStatus;
}): PaidCourseLiveSession {
  return {
    id: row.id,
    courseId: row.course_id,
    mediaAssetId: row.media_asset_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  };
}

export class PostgresPaidLiveRepository {
  constructor(private readonly pool: Pool = getPostgresPool()) {}

  async listByCourse(courseId: string, publishedOnly = false): Promise<PaidCourseLiveSession[]> {
    const result = await this.pool.query<{
      id: string; course_id: string; media_asset_id: string | null; title: string;
      description: string | null; starts_at: Date; ends_at: Date; status: PaidLiveStatus;
    }>(
      `SELECT id, course_id, media_asset_id, title, description, starts_at, ends_at, status
       FROM paid_course_live_sessions
       WHERE course_id=$1 AND ($2::boolean=FALSE OR status='PUBLISHED')
       ORDER BY starts_at ASC`,
      [courseId, publishedOnly],
    );
    return result.rows.map(mapSession);
  }

  async getSession(sessionId: string): Promise<PaidCourseLiveSession | null> {
    const result = await this.pool.query<{
      id: string; course_id: string; media_asset_id: string | null; title: string;
      description: string | null; starts_at: Date; ends_at: Date; status: PaidLiveStatus;
    }>(
      `SELECT id, course_id, media_asset_id, title, description, starts_at, ends_at, status
       FROM paid_course_live_sessions WHERE id=$1 LIMIT 1`,
      [sessionId],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async createSession(input: {
    courseId: string; mediaAssetId?: string | null; title: string; description?: string | null;
    startsAt: Date; endsAt: Date;
  }): Promise<string> {
    if (input.endsAt <= input.startsAt) throw new Error("Paid live end time must be after its start time.");
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO paid_course_live_sessions
       (id, course_id, media_asset_id, title, description, starts_at, ends_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT')`,
      [id, input.courseId, input.mediaAssetId ?? null, input.title.trim(), input.description?.trim() || null, input.startsAt, input.endsAt],
    );
    return id;
  }

  async updateSession(sessionId: string, input: {
    mediaAssetId?: string | null; title: string; description?: string | null;
    startsAt: Date; endsAt: Date; status: PaidLiveStatus;
  }): Promise<void> {
    if (input.endsAt <= input.startsAt) throw new Error("Paid live end time must be after its start time.");
    const result = await this.pool.query(
      `UPDATE paid_course_live_sessions
       SET media_asset_id=$2,title=$3,description=$4,starts_at=$5,ends_at=$6,status=$7,updated_at=NOW()
       WHERE id=$1`,
      [sessionId, input.mediaAssetId ?? null, input.title.trim(), input.description?.trim() || null, input.startsAt, input.endsAt, input.status],
    );
    if (result.rowCount !== 1) throw new Error("Paid live session not found.");
  }

  async deleteSession(sessionId: string): Promise<void> {
    const result = await this.pool.query(`DELETE FROM paid_course_live_sessions WHERE id=$1`, [sessionId]);
    if (result.rowCount !== 1) throw new Error("Paid live session not found.");
  }

  async getEnrollment(studentId: string, courseId: string): Promise<{ status: string } | null> {
    const result = await this.pool.query<{ status: string }>(
      `SELECT status FROM enrollments WHERE student_id=$1 AND course_id=$2 LIMIT 1`,
      [studentId, courseId],
    );
    return result.rows[0] ?? null;
  }

  async getCourseStatus(courseId: string): Promise<string | null> {
    const result = await this.pool.query<{ status: string }>(`SELECT status FROM courses WHERE id=$1 LIMIT 1`, [courseId]);
    return result.rows[0]?.status ?? null;
  }

  async getMediaAsset(mediaAssetId: string): Promise<MediaAsset | null> {
    const result = await this.pool.query<{
      id: string; source_type: string; provider_asset_id: string | null; processing_status: string;
    }>(
      `SELECT id, source_type, provider_asset_id, processing_status FROM media_assets WHERE id=$1 LIMIT 1`,
      [mediaAssetId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, sourceType: row.source_type, providerAssetId: row.provider_asset_id, status: row.processing_status } : null;
  }
}
