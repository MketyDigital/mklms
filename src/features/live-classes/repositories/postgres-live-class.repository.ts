import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { MediaAsset } from "@/providers/media-provider";
import type {
  LiveBatchDefinition,
  LiveSessionDefinition,
  ViewerDisplayMode,
} from "../domain/live-session";
import type { LiveTimelineMessage } from "../domain/live-timeline";
import type {
  LiveAttendeeMessageRecord,
  LiveRoomRepository,
} from "../services/live-room.service";

export interface LiveBatchRuntimeRecord extends LiveBatchDefinition {
  title: string;
  description?: string | null;
  expectedViewerBaseline: number;
  viewerDisplayMode: ViewerDisplayMode;
  endedMessage?: string | null;
  endedRedirectUrl?: string | null;
}

export interface LiveSessionRuntimeRecord extends LiveSessionDefinition {
  mediaAssetId?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaRevealOffsetSeconds?: number | null;
  endedMessage?: string | null;
  endedRedirectUrl?: string | null;
}

export class PostgresLiveClassRepository implements LiveRoomRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async findPublicBatchBySlug(slug: string): Promise<LiveBatchRuntimeRecord | null> {
    const batchResult = await this.pool.query<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      status: string;
      expected_viewer_baseline: number;
      viewer_display_mode: ViewerDisplayMode;
      ended_message: string | null;
      ended_redirect_url: string | null;
    }>(
      `SELECT id, slug, title, description, status,
              expected_viewer_baseline, viewer_display_mode,
              ended_message, ended_redirect_url
       FROM live_batches
       WHERE slug = $1 AND status = 'ACTIVE'
       LIMIT 1`,
      [slug.trim()],
    );
    const batch = batchResult.rows[0];
    if (!batch) return null;

    const sessions = await this.listSessions(batch.id);
    return {
      id: batch.id,
      slug: batch.slug,
      title: batch.title,
      description: batch.description,
      status: batch.status,
      expectedViewerBaseline: batch.expected_viewer_baseline,
      viewerDisplayMode: batch.viewer_display_mode,
      endedMessage: batch.ended_message,
      endedRedirectUrl: batch.ended_redirect_url,
      sessions,
    };
  }

  async listSessions(batchId: string): Promise<LiveSessionRuntimeRecord[]> {
    const result = await this.pool.query<{
      id: string;
      batch_id: string;
      title: string;
      position: number;
      starts_at: Date;
      duration_seconds: number;
      media_asset_id: string | null;
      status: string;
      cta_text: string | null;
      cta_url: string | null;
      cta_reveal_offset_seconds: number | null;
      ended_message: string | null;
      ended_redirect_url: string | null;
    }>(
      `SELECT id, batch_id, title, position, starts_at, duration_seconds,
              media_asset_id, status, cta_text, cta_url,
              cta_reveal_offset_seconds, ended_message, ended_redirect_url
       FROM live_sessions
       WHERE batch_id = $1
       ORDER BY starts_at ASC, position ASC`,
      [batchId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      title: row.title,
      startsAt: row.starts_at,
      durationSeconds: row.duration_seconds,
      position: row.position,
      status: row.status,
      mediaAssetId: row.media_asset_id,
      ctaText: row.cta_text,
      ctaUrl: row.cta_url,
      ctaRevealOffsetSeconds: row.cta_reveal_offset_seconds,
      endedMessage: row.ended_message,
      endedRedirectUrl: row.ended_redirect_url,
    }));
  }

  async getMediaAsset(id: string): Promise<MediaAsset | null> {
    const result = await this.pool.query<{
      id: string;
      source_type: string;
      provider_asset_id: string | null;
      processing_status: string;
    }>(
      `SELECT id, source_type, provider_asset_id, processing_status
       FROM media_assets
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          sourceType: row.source_type,
          providerAssetId: row.provider_asset_id,
          status: row.processing_status,
        }
      : null;
  }

  async listTimelineMessages(sessionId: string): Promise<LiveTimelineMessage[]> {
    const result = await this.pool.query<{
      id: string;
      offset_seconds: number;
      display_name: string;
      message: string;
      position: number;
    }>(
      `SELECT id, offset_seconds, display_name, message, position
       FROM live_timeline_messages
       WHERE session_id = $1
       ORDER BY offset_seconds ASC, position ASC`,
      [sessionId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      offsetSeconds: row.offset_seconds,
      displayName: row.display_name,
      message: row.message,
      position: row.position,
    }));
  }

  async upsertViewerHeartbeat(input: {
    batchId: string;
    sessionId?: string | null;
    viewerTokenHash: string;
    displayName?: string | null;
  }): Promise<{ id: string }> {
    const id = randomUUID();
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO live_viewers (
         id, batch_id, session_id, viewer_token_hash, display_name,
         first_seen_at, last_seen_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW(), NOW())
       ON CONFLICT (batch_id, viewer_token_hash)
       DO UPDATE SET
         session_id = EXCLUDED.session_id,
         display_name = COALESCE(EXCLUDED.display_name, live_viewers.display_name),
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING id`,
      [
        id,
        input.batchId,
        input.sessionId ?? null,
        input.viewerTokenHash,
        input.displayName?.trim() || null,
      ],
    );
    return { id: result.rows[0].id };
  }

  async countActiveViewers(input: {
    batchId: string;
    sessionId?: string | null;
    activeSince: Date;
  }): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM live_viewers
       WHERE batch_id = $1
         AND last_seen_at >= $2
         AND ($3::text IS NULL OR session_id = $3)`,
      [input.batchId, input.activeSince, input.sessionId ?? null],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async findViewerByTokenHash(
    batchId: string,
    viewerTokenHash: string,
  ): Promise<{ id: string; displayName?: string | null } | null> {
    const result = await this.pool.query<{
      id: string;
      display_name: string | null;
    }>(
      `SELECT id, display_name
       FROM live_viewers
       WHERE batch_id = $1 AND viewer_token_hash = $2
       LIMIT 1`,
      [batchId, viewerTokenHash],
    );
    const row = result.rows[0];
    return row ? { id: row.id, displayName: row.display_name } : null;
  }

  async createAttendeeMessage(input: {
    batchId: string;
    sessionId: string;
    viewerId: string;
    displayName?: string | null;
    message: string;
  }): Promise<LiveAttendeeMessageRecord> {
    const result = await this.pool.query<{
      id: string;
      display_name_snapshot: string | null;
      message: string;
      created_at: Date;
    }>(
      `INSERT INTO live_attendee_messages (
         id, batch_id, session_id, viewer_id,
         display_name_snapshot, message, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, display_name_snapshot, message, created_at`,
      [
        randomUUID(),
        input.batchId,
        input.sessionId,
        input.viewerId,
        input.displayName?.trim() || null,
        input.message.trim(),
      ],
    );
    const row = result.rows[0];
    return {
      id: row.id,
      displayName: row.display_name_snapshot,
      message: row.message,
      createdAt: row.created_at,
    };
  }

  async listViewerMessages(viewerId: string): Promise<LiveAttendeeMessageRecord[]> {
    const result = await this.pool.query<{
      id: string;
      display_name_snapshot: string | null;
      message: string;
      created_at: Date;
    }>(
      `SELECT id, display_name_snapshot, message, created_at
       FROM live_attendee_messages
       WHERE viewer_id = $1
       ORDER BY created_at ASC`,
      [viewerId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name_snapshot,
      message: row.message,
      createdAt: row.created_at,
    }));
  }

  async listAdminAttendeeMessages(input: {
    batchId: string;
    sessionId?: string | null;
  }): Promise<LiveAttendeeMessageRecord[]> {
    const result = await this.pool.query<{
      id: string;
      display_name_snapshot: string | null;
      message: string;
      created_at: Date;
    }>(
      `SELECT id, display_name_snapshot, message, created_at
       FROM live_attendee_messages
       WHERE batch_id = $1
         AND ($2::text IS NULL OR session_id = $2)
       ORDER BY created_at DESC`,
      [input.batchId, input.sessionId ?? null],
    );
    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name_snapshot,
      message: row.message,
      createdAt: row.created_at,
    }));
  }

  async markAttendeeMessageRead(messageId: string): Promise<void> {
    await this.pool.query(
      `UPDATE live_attendee_messages
       SET read_by_admin_at = COALESCE(read_by_admin_at, NOW())
       WHERE id = $1`,
      [messageId],
    );
  }
}
