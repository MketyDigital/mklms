import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { ImportedLiveChatItem } from "../domain/import-live-chat";
import type {
  AdminLiveBatchRecord,
  AdminLiveClassRepository,
  AdminLiveSessionRecord,
  LiveBatchAdminStatus,
} from "../services/admin-live-class.service";

export class PostgresAdminLiveClassRepository implements AdminLiveClassRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async listBatches(): Promise<AdminLiveBatchRecord[]> {
    const result = await this.pool.query<{
      id: string; slug: string; title: string; description: string | null;
      status: LiveBatchAdminStatus; expected_viewer_baseline: number;
      viewer_display_mode: AdminLiveBatchRecord["viewerDisplayMode"];
      ended_message: string | null; ended_redirect_url: string | null;
      notification_destination: string | null;
    }>(`SELECT id, slug, title, description, status, expected_viewer_baseline,
               viewer_display_mode, ended_message, ended_redirect_url,
               notification_destination
        FROM live_batches ORDER BY created_at DESC`);
    return result.rows.map((row) => this.mapBatch(row));
  }

  async findBatchById(id: string): Promise<AdminLiveBatchRecord | null> {
    const result = await this.pool.query<{
      id: string; slug: string; title: string; description: string | null;
      status: LiveBatchAdminStatus; expected_viewer_baseline: number;
      viewer_display_mode: AdminLiveBatchRecord["viewerDisplayMode"];
      ended_message: string | null; ended_redirect_url: string | null;
      notification_destination: string | null;
    }>(`SELECT id, slug, title, description, status, expected_viewer_baseline,
               viewer_display_mode, ended_message, ended_redirect_url,
               notification_destination
        FROM live_batches WHERE id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? this.mapBatch(result.rows[0]) : null;
  }

  async createBatch(input: Omit<AdminLiveBatchRecord, "id">): Promise<AdminLiveBatchRecord> {
    const result = await this.pool.query<{
      id: string; slug: string; title: string; description: string | null;
      status: LiveBatchAdminStatus; expected_viewer_baseline: number;
      viewer_display_mode: AdminLiveBatchRecord["viewerDisplayMode"];
      ended_message: string | null; ended_redirect_url: string | null;
      notification_destination: string | null;
    }>(`INSERT INTO live_batches (
          id, slug, title, description, status, expected_viewer_baseline,
          viewer_display_mode, ended_message, ended_redirect_url,
          notification_destination, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
        RETURNING id, slug, title, description, status, expected_viewer_baseline,
                  viewer_display_mode, ended_message, ended_redirect_url,
                  notification_destination`, [
      randomUUID(), input.slug, input.title, input.description ?? null, input.status,
      input.expectedViewerBaseline, input.viewerDisplayMode, input.endedMessage ?? null,
      input.endedRedirectUrl ?? null, input.notificationDestination ?? null,
    ]);
    return this.mapBatch(result.rows[0]);
  }

  async listSessions(batchId: string): Promise<AdminLiveSessionRecord[]> {
    const result = await this.pool.query<{
      id: string; batch_id: string; title: string; position: number; starts_at: Date;
      duration_seconds: number; media_asset_id: string | null; status: "DRAFT" | "PUBLISHED";
      cta_text: string | null; cta_url: string | null; cta_reveal_offset_seconds: number | null;
      ended_message: string | null; ended_redirect_url: string | null;
    }>(`SELECT id,batch_id,title,position,starts_at,duration_seconds,media_asset_id,status,
               cta_text,cta_url,cta_reveal_offset_seconds,ended_message,ended_redirect_url
        FROM live_sessions WHERE batch_id=$1 ORDER BY position ASC`, [batchId]);
    return result.rows.map((row) => ({
      id: row.id, batchId: row.batch_id, title: row.title, position: row.position,
      startsAt: row.starts_at, durationSeconds: row.duration_seconds,
      mediaAssetId: row.media_asset_id, status: row.status, ctaText: row.cta_text,
      ctaUrl: row.cta_url, ctaRevealOffsetSeconds: row.cta_reveal_offset_seconds,
      endedMessage: row.ended_message, endedRedirectUrl: row.ended_redirect_url,
    }));
  }

  async createSession(batchId: string, input: Omit<AdminLiveSessionRecord, "id" | "batchId">): Promise<AdminLiveSessionRecord> {
    const result = await this.pool.query<{
      id: string; batch_id: string; title: string; position: number; starts_at: Date;
      duration_seconds: number; media_asset_id: string | null; status: "DRAFT" | "PUBLISHED";
      cta_text: string | null; cta_url: string | null; cta_reveal_offset_seconds: number | null;
      ended_message: string | null; ended_redirect_url: string | null;
    }>(`INSERT INTO live_sessions (
          id,batch_id,title,position,starts_at,duration_seconds,media_asset_id,status,
          cta_text,cta_url,cta_reveal_offset_seconds,ended_message,ended_redirect_url,
          created_at,updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
        RETURNING id,batch_id,title,position,starts_at,duration_seconds,media_asset_id,status,
                  cta_text,cta_url,cta_reveal_offset_seconds,ended_message,ended_redirect_url`, [
      randomUUID(), batchId, input.title, input.position, input.startsAt, input.durationSeconds,
      input.mediaAssetId ?? null, input.status, input.ctaText ?? null, input.ctaUrl ?? null,
      input.ctaRevealOffsetSeconds ?? null, input.endedMessage ?? null, input.endedRedirectUrl ?? null,
    ]);
    const row = result.rows[0];
    return {
      id: row.id, batchId: row.batch_id, title: row.title, position: row.position,
      startsAt: row.starts_at, durationSeconds: row.duration_seconds,
      mediaAssetId: row.media_asset_id, status: row.status, ctaText: row.cta_text,
      ctaUrl: row.cta_url, ctaRevealOffsetSeconds: row.cta_reveal_offset_seconds,
      endedMessage: row.ended_message, endedRedirectUrl: row.ended_redirect_url,
    };
  }

  async replaceTimelineMessages(sessionId: string, items: ImportedLiveChatItem[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM live_timeline_messages WHERE session_id=$1`, [sessionId]);
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        await this.insertTimeline(client, sessionId, item, index + 1);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async setBatchStatus(batchId: string, status: LiveBatchAdminStatus): Promise<void> {
    await this.pool.query(`UPDATE live_batches SET status=$2, updated_at=NOW() WHERE id=$1`, [batchId, status]);
  }

  async setSessionStatus(sessionId: string, status: "DRAFT" | "PUBLISHED"): Promise<void> {
    await this.pool.query(`UPDATE live_sessions SET status=$2, updated_at=NOW() WHERE id=$1`, [sessionId, status]);
  }

  private insertTimeline(client: PoolClient, sessionId: string, item: ImportedLiveChatItem, position: number) {
    return client.query(`INSERT INTO live_timeline_messages (
      id,session_id,offset_seconds,display_name,message,position,created_at,updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`, [
      randomUUID(), sessionId, item.offsetSeconds, item.displayName, item.message, position,
    ]);
  }

  private mapBatch(row: {
    id: string; slug: string; title: string; description: string | null;
    status: LiveBatchAdminStatus; expected_viewer_baseline: number;
    viewer_display_mode: AdminLiveBatchRecord["viewerDisplayMode"];
    ended_message: string | null; ended_redirect_url: string | null;
    notification_destination: string | null;
  }): AdminLiveBatchRecord {
    return {
      id: row.id, slug: row.slug, title: row.title, description: row.description,
      status: row.status, expectedViewerBaseline: row.expected_viewer_baseline,
      viewerDisplayMode: row.viewer_display_mode, endedMessage: row.ended_message,
      endedRedirectUrl: row.ended_redirect_url, notificationDestination: row.notification_destination,
    };
  }
}
