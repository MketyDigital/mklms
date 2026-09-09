import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import { getBillingMonthKey, type StreamingActivityBand } from "../domain/managed-hosting";

export interface ManagedHostingLedgerEntry {
  billingDate: string;
  monthKey: string;
  measuredWatchMinutes: number;
  estimatedLiveAudienceMinutes: number;
  streamingActivityBand: StreamingActivityBand;
  automaticBalanceUsd: number;
  operatorAdjustmentUsd: number;
  operatorReason: string | null;
  calculationVersion: string;
}

function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function mapRow(row: {
  billing_date: string | Date;
  month_key: string;
  measured_watch_minutes: string | number;
  estimated_live_audience_minutes: string | number;
  streaming_activity_band: StreamingActivityBand;
  automatic_balance_usd: string | number;
  operator_adjustment_usd: string | number;
  operator_reason: string | null;
  calculation_version: string;
}): ManagedHostingLedgerEntry {
  return {
    billingDate: row.billing_date instanceof Date ? row.billing_date.toISOString().slice(0, 10) : String(row.billing_date).slice(0, 10),
    monthKey: row.month_key,
    measuredWatchMinutes: Number(row.measured_watch_minutes),
    estimatedLiveAudienceMinutes: Number(row.estimated_live_audience_minutes),
    streamingActivityBand: row.streaming_activity_band,
    automaticBalanceUsd: Number(row.automatic_balance_usd),
    operatorAdjustmentUsd: Number(row.operator_adjustment_usd),
    operatorReason: row.operator_reason,
    calculationVersion: row.calculation_version,
  };
}

export class PostgresManagedHostingLedgerRepository {
  constructor(private readonly pool: Pool = getPostgresPool()) {}

  async recordDailySnapshot(input: {
    now?: Date;
    measuredWatchMinutes: number;
    estimatedLiveAudienceMinutes: number;
    streamingActivityBand: StreamingActivityBand;
    automaticBalanceUsd: number;
    calculationVersion?: string;
  }): Promise<ManagedHostingLedgerEntry> {
    const now = input.now ?? new Date();
    const billingDate = utcDateKey(now);
    const monthKey = getBillingMonthKey(now);
    const result = await this.pool.query(
      `INSERT INTO managed_hosting_daily_ledger (
         billing_date, month_key, measured_watch_minutes,
         estimated_live_audience_minutes, streaming_activity_band,
         automatic_balance_usd, calculation_version, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (billing_date) DO UPDATE SET
         measured_watch_minutes = EXCLUDED.measured_watch_minutes,
         estimated_live_audience_minutes = EXCLUDED.estimated_live_audience_minutes,
         streaming_activity_band = EXCLUDED.streaming_activity_band,
         automatic_balance_usd = EXCLUDED.automatic_balance_usd,
         calculation_version = EXCLUDED.calculation_version,
         updated_at = NOW()
       RETURNING billing_date, month_key, measured_watch_minutes,
                 estimated_live_audience_minutes, streaming_activity_band,
                 automatic_balance_usd, operator_adjustment_usd,
                 operator_reason, calculation_version`,
      [
        billingDate,
        monthKey,
        Math.max(0, Math.round(input.measuredWatchMinutes)),
        Math.max(0, Math.round(input.estimatedLiveAudienceMinutes)),
        input.streamingActivityBand,
        Math.max(0, Math.round(input.automaticBalanceUsd * 100) / 100),
        input.calculationVersion ?? "streaming-v2",
      ],
    );
    return mapRow(result.rows[0]);
  }

  async setDailyOperatorAdjustment(input: {
    amountUsd: number;
    reason: string;
    now?: Date;
  }): Promise<ManagedHostingLedgerEntry> {
    const now = input.now ?? new Date();
    const billingDate = utcDateKey(now);
    const monthKey = getBillingMonthKey(now);
    const reason = input.reason.trim().slice(0, 1000);
    if (!reason) throw new Error("An operator adjustment reason is required.");
    const amountUsd = Math.round(Number(input.amountUsd) * 100) / 100;
    if (!Number.isFinite(amountUsd)) throw new Error("Invalid operator adjustment amount.");

    const result = await this.pool.query(
      `INSERT INTO managed_hosting_daily_ledger (
         billing_date, month_key, operator_adjustment_usd,
         operator_reason, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (billing_date) DO UPDATE SET
         operator_adjustment_usd = EXCLUDED.operator_adjustment_usd,
         operator_reason = EXCLUDED.operator_reason,
         updated_at = NOW()
       RETURNING billing_date, month_key, measured_watch_minutes,
                 estimated_live_audience_minutes, streaming_activity_band,
                 automatic_balance_usd, operator_adjustment_usd,
                 operator_reason, calculation_version`,
      [billingDate, monthKey, amountUsd, reason],
    );
    return mapRow(result.rows[0]);
  }

  async getMonthAdjustmentTotal(monthKey = getBillingMonthKey()): Promise<number> {
    const result = await this.pool.query<{ total: string | number }>(
      `SELECT COALESCE(SUM(operator_adjustment_usd), 0) AS total
       FROM managed_hosting_daily_ledger
       WHERE month_key = $1`,
      [monthKey],
    );
    return Math.round(Number(result.rows[0]?.total ?? 0) * 100) / 100;
  }

  async listMonth(monthKey = getBillingMonthKey()): Promise<ManagedHostingLedgerEntry[]> {
    const result = await this.pool.query(
      `SELECT billing_date, month_key, measured_watch_minutes,
              estimated_live_audience_minutes, streaming_activity_band,
              automatic_balance_usd, operator_adjustment_usd,
              operator_reason, calculation_version
       FROM managed_hosting_daily_ledger
       WHERE month_key = $1
       ORDER BY billing_date DESC`,
      [monthKey],
    );
    return result.rows.map(mapRow);
  }
}
