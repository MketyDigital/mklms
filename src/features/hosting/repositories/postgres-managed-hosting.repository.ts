import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { ManagedHostingSettings } from "../domain/managed-hosting";

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

  async getSettings(): Promise<ManagedHostingSettings> {
    const result = await this.pool.query<{
      enabled: boolean;
      minimum_monthly_fee_usd: string | number;
      maximum_monthly_fee_usd: string | number;
      current_monthly_fee_usd: string | number;
      payment_network: "TRC20" | "TON" | "CUSTOM";
      wallet_address: string;
      payment_note: string | null;
    }>(
      `SELECT enabled, minimum_monthly_fee_usd, maximum_monthly_fee_usd,
              current_monthly_fee_usd, payment_network, wallet_address, payment_note
       FROM managed_hosting_settings
       WHERE id = 'default'
       LIMIT 1`,
    );
    const row = result.rows[0];
    return {
      enabled: row?.enabled ?? false,
      minimumMonthlyFeeUsd: Number(row?.minimum_monthly_fee_usd ?? 15),
      maximumMonthlyFeeUsd: Number(row?.maximum_monthly_fee_usd ?? 50),
      currentMonthlyFeeUsd: Number(row?.current_monthly_fee_usd ?? 15),
      paymentNetwork: row?.payment_network ?? "TRC20",
      walletAddress: row?.wallet_address ?? "",
      paymentNote: row?.payment_note ?? null,
    };
  }

  async updateSettings(settings: ManagedHostingSettings): Promise<void> {
    await this.pool.query(
      `INSERT INTO managed_hosting_settings (
         id, enabled, minimum_monthly_fee_usd, maximum_monthly_fee_usd,
         current_monthly_fee_usd, payment_network, wallet_address,
         payment_note, updated_at
       )
       VALUES ('default', $1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id)
       DO UPDATE SET
         enabled = EXCLUDED.enabled,
         minimum_monthly_fee_usd = EXCLUDED.minimum_monthly_fee_usd,
         maximum_monthly_fee_usd = EXCLUDED.maximum_monthly_fee_usd,
         current_monthly_fee_usd = EXCLUDED.current_monthly_fee_usd,
         payment_network = EXCLUDED.payment_network,
         wallet_address = EXCLUDED.wallet_address,
         payment_note = EXCLUDED.payment_note,
         updated_at = NOW()`,
      [
        settings.enabled,
        settings.minimumMonthlyFeeUsd,
        settings.maximumMonthlyFeeUsd,
        settings.currentMonthlyFeeUsd,
        settings.paymentNetwork,
        settings.walletAddress,
        settings.paymentNote ?? null,
      ],
    );
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
}
