import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { MediaIngestState } from "../domain/media-ingest";

export interface MediaIngestJob {
  id: string;
  mediaAssetId: string | null;
  title: string;
  state: MediaIngestState;
  sourceObjectKey: string | null;
  ociJobId: string | null;
  ociOutputPrefix: string | null;
  r2Prefix: string | null;
  r2MasterManifest: string | null;
  durationMinutes: number | null;
  estimatedCostUsd: number | null;
  costAcceptedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: Record<string, unknown>): MediaIngestJob {
  return {
    id: String(row.id),
    mediaAssetId: row.media_asset_id ? String(row.media_asset_id) : null,
    title: String(row.title),
    state: String(row.state) as MediaIngestState,
    sourceObjectKey: row.source_object_key ? String(row.source_object_key) : null,
    ociJobId: row.oci_job_id ? String(row.oci_job_id) : null,
    ociOutputPrefix: row.oci_output_prefix ? String(row.oci_output_prefix) : null,
    r2Prefix: row.r2_prefix ? String(row.r2_prefix) : null,
    r2MasterManifest: row.r2_master_manifest ? String(row.r2_master_manifest) : null,
    durationMinutes: row.duration_minutes === null || row.duration_minutes === undefined ? null : Number(row.duration_minutes),
    estimatedCostUsd: row.estimated_cost_usd === null || row.estimated_cost_usd === undefined ? null : Number(row.estimated_cost_usd),
    costAcceptedAt: row.cost_accepted_at ? new Date(String(row.cost_accepted_at)) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export class PostgresMediaIngestRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async listJobs(): Promise<MediaIngestJob[]> {
    const result = await this.pool.query(
      `SELECT * FROM media_ingest_jobs ORDER BY created_at DESC LIMIT 100`,
    );
    return result.rows.map((row) => mapRow(row));
  }

  async createEstimate(input: {
    title: string;
    durationMinutes: number;
    estimatedCostUsd: number;
  }): Promise<MediaIngestJob> {
    const result = await this.pool.query(
      `INSERT INTO media_ingest_jobs (
         id, title, state, duration_minutes, estimated_cost_usd,
         created_at, updated_at
       )
       VALUES ($1, $2, 'DRAFT', $3, $4, NOW(), NOW())
       RETURNING *`,
      [randomUUID(), input.title.trim(), input.durationMinutes, input.estimatedCostUsd],
    );
    return mapRow(result.rows[0]);
  }

  async acceptCost(id: string): Promise<MediaIngestJob | null> {
    const result = await this.pool.query(
      `UPDATE media_ingest_jobs
       SET cost_accepted_at = COALESCE(cost_accepted_at, NOW()), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async updateManualStatus(input: {
    id: string;
    state: MediaIngestState;
    sourceObjectKey?: string | null;
    ociJobId?: string | null;
    ociOutputPrefix?: string | null;
    r2Prefix?: string | null;
    r2MasterManifest?: string | null;
    errorMessage?: string | null;
  }): Promise<MediaIngestJob | null> {
    const result = await this.pool.query(
      `UPDATE media_ingest_jobs
       SET state = $2,
           source_object_key = COALESCE($3, source_object_key),
           oci_job_id = COALESCE($4, oci_job_id),
           oci_output_prefix = COALESCE($5, oci_output_prefix),
           r2_prefix = COALESCE($6, r2_prefix),
           r2_master_manifest = COALESCE($7, r2_master_manifest),
           error_message = $8,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.id,
        input.state,
        input.sourceObjectKey ?? null,
        input.ociJobId ?? null,
        input.ociOutputPrefix ?? null,
        input.r2Prefix ?? null,
        input.r2MasterManifest ?? null,
        input.errorMessage ?? null,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
}
