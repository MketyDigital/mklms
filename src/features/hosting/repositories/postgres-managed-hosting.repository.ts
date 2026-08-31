import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import { getBillingMonthKey, type ManagedHostingMonthOverride } from "../domain/managed-hosting";

export interface ManagedHostingUsageSummary {
  monthStart: Date;
  courseWatchMinutesMeasured: number;
  liveAudienceMinutesEstimated: number;
  ociMediaFlowEstimatedCostUsd: number;
}

export class PostgresManagedHostingRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async getCurrentMonthUsage(now = new Date()): Promise<ManagedHostingUsageSummary> {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [course, live, ingest] = await Promise.all([
      this.pool.query<{ seconds: string | number }>(
        `SELECT COALESCE(SUM(credited_seconds), 0) AS seconds
         FROM media_watch_credits
         WHERE last_credited_at >= $1 AND last_credited_at < $2`,
        [monthStart, nextMonth],
      ),
      this.pool.query<{ audience_seconds: string | number }>(
        `SELECT COALESCE(SUM(lb.expected_viewer_baseline * ls.duration_seconds), 0) AS audience_seconds
         FROM live_sessions ls
         JOIN live_batches lb ON lb.id = ls.batch_id
         WHERE ls.starts_at >= $1 AND ls.starts_at < $2
           AND ls.status = 'PUBLISHED'
           AND lb.viewer_display_mode = 'CONFIGURED_BASELINE'`,
        [monthStart, nextMonth],
      ),
      this.pool.query<{ cost: string | number }>(
        `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS cost
         FROM media_ingest_jobs
         WHERE created_at >= $1 AND created_at < $2
           AND cost_accepted_at IS NOT NULL`,
        [monthStart, nextMonth],
      ),
    ]);

    return {
      monthStart,
      courseWatchMinutesMeasured: Math.round(Number(course.rows[0]?.seconds ?? 0) / 60),
      liveAudienceMinutesEstimated: Math.round(Number(live.rows[0]?.audience_seconds ?? 0) / 60),
      ociMediaFlowEstimatedCostUsd: Math.round(Number(ingest.rows[0]?.cost ?? 0) * 100) / 100,
    };
  }

  async getMonthOverride(monthKey = getBillingMonthKey()): Promise<ManagedHostingMonthOverride | null> {
    const result = await this.pool.query<{
      month_key: string;
      minimum_floor_usd: string | number;
      operator_note: string | null;
      payment_status: "PENDING" | "PAID" | "WAIVED";
    }>(
      `SELECT month_key, minimum_floor_usd, operator_note, payment_status
       FROM managed_hosting_months
       WHERE month_key = $1
       LIMIT 1`,
      [monthKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      monthKey: row.month_key,
      minimumFloorUsd: Number(row.minimum_floor_usd),
      operatorNote: row.operator_note,
      paymentStatus: row.payment_status,
    };
  }

  async upsertMonthOverride(input: {
    monthKey: string;
    minimumFloorUsd: number;
    operatorNote?: string | null;
    paymentStatus?: "PENDING" | "PAID" | "WAIVED";
  }): Promise<ManagedHostingMonthOverride> {
    const result = await this.pool.query<{
      month_key: string;
      minimum_floor_usd: string | number;
      operator_note: string | null;
      payment_status: "PENDING" | "PAID" | "WAIVED";
    }>(
      `INSERT INTO managed_hosting_months (
         month_key, minimum_floor_usd, operator_note, payment_status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (month_key)
       DO UPDATE SET
         minimum_floor_usd = EXCLUDED.minimum_floor_usd,
         operator_note = EXCLUDED.operator_note,
         payment_status = EXCLUDED.payment_status,
         updated_at = NOW()
       RETURNING month_key, minimum_floor_usd, operator_note, payment_status`,
      [
        input.monthKey,
        Math.max(0, Math.round(input.minimumFloorUsd * 100) / 100),
        input.operatorNote?.trim().slice(0, 2000) || null,
        input.paymentStatus ?? "PENDING",
      ],
    );
    const row = result.rows[0];
    return {
      monthKey: row.month_key,
      minimumFloorUsd: Number(row.minimum_floor_usd),
      operatorNote: row.operator_note,
      paymentStatus: row.payment_status,
    };
  }
}
