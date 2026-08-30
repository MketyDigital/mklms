import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";

export interface AdminMediaAsset {
  id: string;
  title: string;
  provider: string;
  sourceType: string;
  providerAssetId?: string | null;
  durationSeconds?: number | null;
  status: string;
  createdAt: Date;
}

export interface CreateAdminMediaAssetInput {
  title: string;
  provider: string;
  sourceType: "HLS" | "DIRECT" | "YOUTUBE" | "EXTERNAL_EMBED" | "CUSTOM";
  providerAssetId: string;
  durationSeconds?: number | null;
  status?: "PENDING" | "PROCESSING" | "READY" | "FAILED";
}

export class PostgresAdminMediaRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async listAssets(): Promise<AdminMediaAsset[]> {
    const result = await this.pool.query<{
      id: string;
      title: string;
      provider: string;
      source_type: string;
      provider_asset_id: string | null;
      duration_seconds: number | null;
      processing_status: string;
      created_at: Date;
    }>(
      `SELECT id, title, provider, source_type, provider_asset_id,
              duration_seconds, processing_status, created_at
       FROM media_assets
       ORDER BY created_at DESC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      provider: row.provider,
      sourceType: row.source_type,
      providerAssetId: row.provider_asset_id,
      durationSeconds: row.duration_seconds,
      status: row.processing_status,
      createdAt: row.created_at,
    }));
  }

  async createAsset(input: CreateAdminMediaAssetInput): Promise<AdminMediaAsset> {
    const id = randomUUID();
    const result = await this.pool.query<{
      id: string;
      title: string;
      provider: string;
      source_type: string;
      provider_asset_id: string | null;
      duration_seconds: number | null;
      processing_status: string;
      created_at: Date;
    }>(
      `INSERT INTO media_assets (
         id, title, provider, source_type, provider_asset_id,
         duration_seconds, processing_status, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, title, provider, source_type, provider_asset_id,
                 duration_seconds, processing_status, created_at`,
      [
        id,
        input.title.trim(),
        input.provider.trim() || "custom",
        input.sourceType,
        input.providerAssetId.trim(),
        input.durationSeconds ?? null,
        input.status ?? "READY",
      ],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      provider: row.provider,
      sourceType: row.source_type,
      providerAssetId: row.provider_asset_id,
      durationSeconds: row.duration_seconds,
      status: row.processing_status,
      createdAt: row.created_at,
    };
  }

  async deleteAsset(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM media_assets WHERE id = $1`, [id]);
  }
}
