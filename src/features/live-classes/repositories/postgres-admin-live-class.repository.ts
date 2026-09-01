import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { ImportedLiveChatItem } from "../domain/import-live-chat";
import type { ViewerDisplayMode } from "../domain/live-session";
import type {
  AdminLiveBatchRecord,
  AdminLiveClassRepository,
  AdminLiveSessionRecord,
  LiveBatchAdminStatus,
  LiveTimelineSummary,
} from "../services/admin-live-class.service";

type BatchRow = {
  id: string; slug: string; title: string; description: string | null; status: LiveBatchAdminStatus;
  expected_viewer_baseline: number; viewer_display_mode: ViewerDisplayMode; ended_message: string | null;
  ended_redirect_url: string | null; notification_destination: string | null;
};

type SessionRow = {
  id: string; batch_id: string; title: string; position: number; starts_at: Date; duration_seconds: number;
  media_asset_id: string | null; status: "DRAFT" | "PUBLISHED"; cta_text: string | null; cta_url: string | null;
  cta_reveal_offset_seconds: number | null; ended_message: string | null; ended_redirect_url: string | null;
};

const SESSION_SELECT = `SELECT id,batch_id,title,position,starts_at,duration_seconds,media_asset_id,status,
               cta_text,cta_url,cta_reveal_offset_seconds,ended_message,ended_redirect_url`;

export class PostgresAdminLiveClassRepository implements AdminLiveClassRepository {
  private readonly pool: Pool;
  constructor(pool: Pool = getPostgresPool()) { this.pool = pool; }

  async listBatches(): Promise<AdminLiveBatchRecord[]> {
    const result = await this.pool.query<BatchRow>(`SELECT id, slug, title, description, status, expected_viewer_baseline,
               viewer_display_mode, ended_message, ended_redirect_url, notification_destination
        FROM live_batches ORDER BY created_at DESC`);
    return result.rows.map((row) => this.mapBatch(row));
  }

  async findBatchById(id: string): Promise<AdminLiveBatchRecord | null> {
    const result = await this.pool.query<BatchRow>(`SELECT id, slug, title, description, status, expected_viewer_baseline,
               viewer_display_mode, ended_message, ended_redirect_url, notification_destination
        FROM live_batches WHERE id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? this.mapBatch(result.rows[0]) : null;
  }

  async createBatch(input: Omit<AdminLiveBatchRecord, "id">): Promise<AdminLiveBatchRecord> {
    const result = await this.pool.query<BatchRow>(`INSERT INTO live_batches (
          id, slug, title, description, status, expected_viewer_baseline, viewer_display_mode,
          ended_message, ended_redirect_url, notification_destination, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
        RETURNING id, slug, title, description, status, expected_viewer_baseline,
                  viewer_display_mode, ended_message, ended_redirect_url, notification_destination`, [
      randomUUID(), input.slug, input.title, input.description ?? null, input.status,
      input.expectedViewerBaseline, input.viewerDisplayMode, input.endedMessage ?? null,
      input.endedRedirectUrl ?? null, input.notificationDestination ?? null,
    ]);
    return this.mapBatch(result.rows[0]);
  }

  async updateBatch(batchId: string, input: Omit<AdminLiveBatchRecord, "id" | "status">): Promise<void> {
    const result = await this.pool.query(`UPDATE live_batches SET
      slug=$2,title=$3,description=$4,expected_viewer_baseline=$5,viewer_display_mode=$6,
      ended_message=$7,ended_redirect_url=$8,notification_destination=$9,updated_at=NOW()
      WHERE id=$1`, [batchId,input.slug,input.title,input.description ?? null,input.expectedViewerBaseline,input.viewerDisplayMode,input.endedMessage ?? null,input.endedRedirectUrl ?? null,input.notificationDestination ?? null]);
    if (result.rowCount !== 1) throw new Error("Live class not found.");
  }

  async deleteBatch(batchId: string): Promise<void> {
    const result = await this.pool.query(`DELETE FROM live_batches WHERE id=$1`, [batchId]);
    if (result.rowCount !== 1) throw new Error("Live class not found.");
  }

  async listSessions(batchId: string): Promise<AdminLiveSessionRecord[]> {
    const result = await this.pool.query<SessionRow>(`${SESSION_SELECT}
        FROM live_sessions WHERE batch_id=$1 ORDER BY position ASC`, [batchId]);
    return result.rows.map((row) => this.mapSession(row));
  }

  async findSessionById(sessionId: string): Promise<AdminLiveSessionRecord | null> {
    const result = await this.pool.query<SessionRow>(`${SESSION_SELECT}
        FROM live_sessions WHERE id=$1 LIMIT 1`, [sessionId]);
    return result.rows[0] ? this.mapSession(result.rows[0]) : null;
  }

  async createSession(batchId: string, input: Omit<AdminLiveSessionRecord, "id" | "batchId">): Promise<AdminLiveSessionRecord> {
    const result = await this.pool.query<SessionRow>(`INSERT INTO live_sessions (
          id,batch_id,title,position,starts_at,duration_seconds,media_asset_id,status,
          cta_text,cta_url,cta_reveal_offset_seconds,ended_message,ended_redirect_url,created_at,updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
        RETURNING id,batch_id,title,position,starts_at,duration_seconds,media_asset_id,status,
                  cta_text,cta_url,cta_reveal_offset_seconds,ended_message,ended_redirect_url`, [
      randomUUID(), batchId, input.title, input.position, input.startsAt, input.durationSeconds,
      input.mediaAssetId ?? null, input.status, input.ctaText ?? null, input.ctaUrl ?? null,
      input.ctaRevealOffsetSeconds ?? null, input.endedMessage ?? null, input.endedRedirectUrl ?? null,
    ]);
    return this.mapSession(result.rows[0]);
  }

  async updateSession(sessionId: string, input: Omit<AdminLiveSessionRecord, "id" | "batchId" | "status">): Promise<void> {
    const result = await this.pool.query(`UPDATE live_sessions SET
      title=$2,position=$3,starts_at=$4,duration_seconds=$5,media_asset_id=$6,
      cta_text=$7,cta_url=$8,cta_reveal_offset_seconds=$9,ended_message=$10,ended_redirect_url=$11,updated_at=NOW()
      WHERE id=$1`, [sessionId,input.title,input.position,input.startsAt,input.durationSeconds,input.mediaAssetId ?? null,input.ctaText ?? null,input.ctaUrl ?? null,input.ctaRevealOffsetSeconds ?? null,input.endedMessage ?? null,input.endedRedirectUrl ?? null]);
    if (result.rowCount !== 1) throw new Error("Live session not found.");
  }

  async deleteSession(sessionId: string): Promise<void> {
    const result = await this.pool.query(`DELETE FROM live_sessions WHERE id=$1`, [sessionId]);
    if (result.rowCount !== 1) throw new Error("Live session not found.");
  }

  async replaceTimelineMessages(sessionId: string, items: ImportedLiveChatItem[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM live_timeline_messages WHERE session_id=$1`, [sessionId]);
      for (let index = 0; index < items.length; index += 1) await this.insertTimeline(client, sessionId, items[index], index + 1);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async getTimelineSummary(sessionId: string): Promise<LiveTimelineSummary> {
    const result = await this.pool.query<{
      count: number | string;
      first_offset_seconds: number | string | null;
      last_offset_seconds: number | string | null;
    }>(`SELECT COUNT(*)::int AS count,
              MIN(offset_seconds)::int AS first_offset_seconds,
              MAX(offset_seconds)::int AS last_offset_seconds
       FROM live_timeline_messages
       WHERE session_id=$1`, [sessionId]);
    const row = result.rows[0];
    return {
      count: Number(row?.count ?? 0),
      firstOffsetSeconds: row?.first_offset_seconds == null ? null : Number(row.first_offset_seconds),
      lastOffsetSeconds: row?.last_offset_seconds == null ? null : Number(row.last_offset_seconds),
    };
  }

  async setBatchStatus(batchId: string, status: LiveBatchAdminStatus): Promise<void> {
    const result = await this.pool.query(`UPDATE live_batches SET status=$2, updated_at=NOW() WHERE id=$1`, [batchId, status]);
    if (result.rowCount !== 1) throw new Error("Live class not found.");
  }

  async setSessionStatus(sessionId: string, status: "DRAFT" | "PUBLISHED"): Promise<void> {
    const result = await this.pool.query(`UPDATE live_sessions SET status=$2, updated_at=NOW() WHERE id=$1`, [sessionId, status]);
    if (result.rowCount !== 1) throw new Error("Live session not found.");
  }

  private insertTimeline(client: PoolClient, sessionId: string, item: ImportedLiveChatItem, position: number) {
    return client.query(`INSERT INTO live_timeline_messages (id,session_id,offset_seconds,display_name,message,position,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`, [randomUUID(), sessionId, item.offsetSeconds, item.displayName, item.message, position]);
  }

  private mapSession(row: SessionRow): AdminLiveSessionRecord {
    return { id: row.id,batchId: row.batch_id,title: row.title,position: row.position,startsAt: row.starts_at,durationSeconds: row.duration_seconds,
      mediaAssetId: row.media_asset_id,status: row.status,ctaText: row.cta_text,ctaUrl: row.cta_url,ctaRevealOffsetSeconds: row.cta_reveal_offset_seconds,
      endedMessage: row.ended_message,endedRedirectUrl: row.ended_redirect_url };
  }

  private mapBatch(row: BatchRow): AdminLiveBatchRecord {
    return { id: row.id,slug: row.slug,title: row.title,description: row.description,status: row.status,
      expectedViewerBaseline: row.expected_viewer_baseline,viewerDisplayMode: row.viewer_display_mode,endedMessage: row.ended_message,
      endedRedirectUrl: row.ended_redirect_url,notificationDestination: row.notification_destination };
  }
}
