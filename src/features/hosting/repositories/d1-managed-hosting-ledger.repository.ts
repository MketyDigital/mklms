import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";
import { getBillingMonthKey, type StreamingActivityBand } from "../domain/managed-hosting.ts";

export interface D1ManagedHostingLedgerEntry {
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
type LedgerRow = {
  billing_date: string;
  month_key: string;
  measured_watch_minutes: number;
  estimated_live_audience_minutes: number;
  streaming_activity_band: StreamingActivityBand;
  automatic_balance_cents: number;
  operator_adjustment_cents: number;
  operator_reason: string | null;
  calculation_version: string;
};
function cents(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Invalid managed-hosting amount.");
  const rounded = Math.round(value * 100);
  if (!Number.isSafeInteger(rounded)) throw new Error("Managed-hosting amount exceeds safe integer cents range.");
  return rounded;
}
function map(row: LedgerRow): D1ManagedHostingLedgerEntry {
  return {
    billingDate: row.billing_date.slice(0, 10), monthKey: row.month_key,
    measuredWatchMinutes: Number(row.measured_watch_minutes),
    estimatedLiveAudienceMinutes: Number(row.estimated_live_audience_minutes),
    streamingActivityBand: row.streaming_activity_band,
    automaticBalanceUsd: row.automatic_balance_cents / 100,
    operatorAdjustmentUsd: row.operator_adjustment_cents / 100,
    operatorReason: row.operator_reason, calculationVersion: row.calculation_version,
  };
}
const SELECT = `SELECT billing_date,month_key,measured_watch_minutes,estimated_live_audience_minutes,
 streaming_activity_band,automatic_balance_cents,operator_adjustment_cents,operator_reason,calculation_version
 FROM managed_hosting_daily_ledger`;

/** D1 daily usage snapshots and operator adjustments, with money stored as cents. */
export class D1ManagedHostingLedgerRepository {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }

  async recordDailySnapshot(input: { now?: Date; measuredWatchMinutes: number; estimatedLiveAudienceMinutes: number; streamingActivityBand: StreamingActivityBand; automaticBalanceUsd: number; calculationVersion?: string }): Promise<D1ManagedHostingLedgerEntry> {
    const now = input.now ?? new Date();
    const billingDate = now.toISOString().slice(0, 10);
    const version = input.calculationVersion ?? "streaming-v3";
    await executeD1(this.db, { sql: `INSERT INTO managed_hosting_daily_ledger(
      billing_date,month_key,measured_watch_minutes,estimated_live_audience_minutes,streaming_activity_band,automatic_balance_cents,calculation_version,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(billing_date) DO UPDATE SET measured_watch_minutes=excluded.measured_watch_minutes,
      estimated_live_audience_minutes=excluded.estimated_live_audience_minutes,streaming_activity_band=excluded.streaming_activity_band,
      automatic_balance_cents=CASE WHEN managed_hosting_daily_ledger.calculation_version=excluded.calculation_version
        THEN MAX(managed_hosting_daily_ledger.automatic_balance_cents,excluded.automatic_balance_cents)
        ELSE excluded.automatic_balance_cents END,
      calculation_version=excluded.calculation_version,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`, params: [billingDate,getBillingMonthKey(now),Math.max(0,Math.round(input.measuredWatchMinutes)),Math.max(0,Math.round(input.estimatedLiveAudienceMinutes)),input.streamingActivityBand,cents(Math.max(0,input.automaticBalanceUsd)),version] });
    return (await this.getDate(billingDate))!;
  }

  async setDailyOperatorAdjustment(input: { amountUsd: number; reason: string; now?: Date }): Promise<D1ManagedHostingLedgerEntry> {
    const now = input.now ?? new Date();
    const billingDate = now.toISOString().slice(0, 10);
    const reason = input.reason.trim().slice(0, 1000);
    if (!reason) throw new Error("An operator adjustment reason is required.");
    await executeD1(this.db, { sql: `INSERT INTO managed_hosting_daily_ledger(billing_date,month_key,operator_adjustment_cents,operator_reason,created_at,updated_at)
      VALUES(?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(billing_date) DO UPDATE SET operator_adjustment_cents=excluded.operator_adjustment_cents,
      operator_reason=excluded.operator_reason,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`, params: [billingDate,getBillingMonthKey(now),cents(input.amountUsd),reason] });
    return (await this.getDate(billingDate))!;
  }

  async getMonthPeakAutomaticBalance(monthKey = getBillingMonthKey(), calculationVersion = "streaming-v3"): Promise<number> {
    const rows = await queryD1Rows<{ peak: number }>(this.db, { sql: "SELECT COALESCE(MAX(automatic_balance_cents),0) AS peak FROM managed_hosting_daily_ledger WHERE month_key=? AND calculation_version=?", params: [monthKey,calculationVersion] });
    return Number(rows[0]?.peak ?? 0) / 100;
  }
  async getMonthAdjustmentTotal(monthKey = getBillingMonthKey()): Promise<number> {
    const rows = await queryD1Rows<{ total: number }>(this.db, { sql: "SELECT COALESCE(SUM(operator_adjustment_cents),0) AS total FROM managed_hosting_daily_ledger WHERE month_key=?", params: [monthKey] });
    return Number(rows[0]?.total ?? 0) / 100;
  }
  async listMonth(monthKey = getBillingMonthKey()): Promise<D1ManagedHostingLedgerEntry[]> {
    const rows = await queryD1Rows<LedgerRow>(this.db, { sql: `${SELECT} WHERE month_key=? ORDER BY billing_date DESC`, params: [monthKey] });
    return rows.map(map);
  }
  private async getDate(billingDate: string): Promise<D1ManagedHostingLedgerEntry | null> {
    const rows = await queryD1Rows<LedgerRow>(this.db, { sql: `${SELECT} WHERE billing_date=? LIMIT 1`, params: [billingDate] });
    return rows[0] ? map(rows[0]) : null;
  }
}
