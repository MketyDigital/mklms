import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import { getBillingMonthKey, type ManagedHostingMonthOverride } from "../domain/managed-hosting";

export interface ManagedHostingUsageSummary {
  monthStart: Date;
  courseWatchMinutesMeasured: number;
  liveAudienceMinutesEstimated: number;
}

export interface ManagedHostingOperatorPolicyRecord {
  configured: boolean;
  enabled: boolean;
  minimumMonthlyFeeUsd: number;
  maximumMonthlyFeeUsd: number;
  displayTitle: string;
  displayDescription: string | null;
  notice: string | null;
  overdueWarning: string | null;
  dueDaysAfterMonthEnd: number;
  graceDays: number;
  enforcementEnabled: boolean;
}

function mapMonthRow(row: {
  month_key: string;
  minimum_floor_usd: string | number;
  operator_note: string | null;
  payment_status: "PENDING" | "PAID" | "WAIVED";
  amount_due_usd?: string | number | null;
  due_at?: Date | string | null;
  grace_ends_at?: Date | string | null;
}): ManagedHostingMonthOverride {
  return {
    monthKey: row.month_key,
    minimumFloorUsd: Number(row.minimum_floor_usd),
    operatorNote: row.operator_note,
    paymentStatus: row.payment_status,
    amountDueUsd: row.amount_due_usd == null ? null : Number(row.amount_due_usd),
    dueAt: row.due_at ? new Date(row.due_at) : null,
    graceEndsAt: row.grace_ends_at ? new Date(row.grace_ends_at) : null,
  };
}

export class PostgresManagedHostingRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async getUsageForMonth(monthStart: Date): Promise<ManagedHostingUsageSummary> {
    const start = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

    const [course, live] = await Promise.all([
      this.pool.query<{ seconds: string | number }>(
        `SELECT COALESCE(SUM(credited_seconds), 0) AS seconds
         FROM media_watch_credits
         WHERE last_credited_at >= $1 AND last_credited_at < $2`,
        [start, nextMonth],
      ),
      this.pool.query<{ audience_seconds: string | number }>(
        `SELECT COALESCE(SUM(lb.expected_viewer_baseline * ls.duration_seconds), 0) AS audience_seconds
         FROM live_sessions ls
         JOIN live_batches lb ON lb.id = ls.batch_id
         WHERE ls.starts_at >= $1 AND ls.starts_at < $2
           AND ls.status = 'PUBLISHED'
           AND lb.viewer_display_mode = 'CONFIGURED_BASELINE'`,
        [start, nextMonth],
      ),
    ]);

    return {
      monthStart: start,
      courseWatchMinutesMeasured: Math.round(Number(course.rows[0]?.seconds ?? 0) / 60),
      liveAudienceMinutesEstimated: Math.round(Number(live.rows[0]?.audience_seconds ?? 0) / 60),
    };
  }

  getCurrentMonthUsage(now = new Date()): Promise<ManagedHostingUsageSummary> {
    return this.getUsageForMonth(now);
  }

  async getOperatorPolicy(): Promise<ManagedHostingOperatorPolicyRecord | null> {
    const result = await this.pool.query<{
      configured: boolean;
      enabled: boolean;
      minimum_monthly_fee_usd: string | number;
      maximum_monthly_fee_usd: string | number;
      display_title: string;
      display_description: string | null;
      notice: string | null;
      overdue_warning: string | null;
      due_days_after_month_end: number;
      grace_days: number;
      enforcement_enabled: boolean;
    }>(
      `SELECT configured, enabled, minimum_monthly_fee_usd, maximum_monthly_fee_usd,
              display_title, display_description, notice, overdue_warning,
              due_days_after_month_end, grace_days, enforcement_enabled
       FROM managed_hosting_operator_policy
       WHERE id = 1
       LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      configured: row.configured,
      enabled: row.enabled,
      minimumMonthlyFeeUsd: Number(row.minimum_monthly_fee_usd),
      maximumMonthlyFeeUsd: Number(row.maximum_monthly_fee_usd),
      displayTitle: row.display_title,
      displayDescription: row.display_description,
      notice: row.notice,
      overdueWarning: row.overdue_warning,
      dueDaysAfterMonthEnd: Number(row.due_days_after_month_end),
      graceDays: Number(row.grace_days),
      enforcementEnabled: row.enforcement_enabled,
    };
  }

  async upsertOperatorPolicy(input: Omit<ManagedHostingOperatorPolicyRecord, "configured">): Promise<ManagedHostingOperatorPolicyRecord> {
    const result = await this.pool.query<{
      configured: boolean;
      enabled: boolean;
      minimum_monthly_fee_usd: string | number;
      maximum_monthly_fee_usd: string | number;
      display_title: string;
      display_description: string | null;
      notice: string | null;
      overdue_warning: string | null;
      due_days_after_month_end: number;
      grace_days: number;
      enforcement_enabled: boolean;
    }>(
      `INSERT INTO managed_hosting_operator_policy (
         id, configured, enabled, minimum_monthly_fee_usd, maximum_monthly_fee_usd,
         display_title, display_description, notice, overdue_warning,
         due_days_after_month_end, grace_days, enforcement_enabled, updated_at
       ) VALUES (1, TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (id) DO UPDATE SET
         configured = TRUE,
         enabled = EXCLUDED.enabled,
         minimum_monthly_fee_usd = EXCLUDED.minimum_monthly_fee_usd,
         maximum_monthly_fee_usd = EXCLUDED.maximum_monthly_fee_usd,
         display_title = EXCLUDED.display_title,
         display_description = EXCLUDED.display_description,
         notice = EXCLUDED.notice,
         overdue_warning = EXCLUDED.overdue_warning,
         due_days_after_month_end = EXCLUDED.due_days_after_month_end,
         grace_days = EXCLUDED.grace_days,
         enforcement_enabled = EXCLUDED.enforcement_enabled,
         updated_at = NOW()
       RETURNING configured, enabled, minimum_monthly_fee_usd, maximum_monthly_fee_usd,
                 display_title, display_description, notice, overdue_warning,
                 due_days_after_month_end, grace_days, enforcement_enabled`,
      [
        input.enabled,
        Math.max(0, Math.round(input.minimumMonthlyFeeUsd * 100) / 100),
        Math.max(0, Math.round(input.maximumMonthlyFeeUsd * 100) / 100),
        input.displayTitle.trim().slice(0, 200) || "Managed Video Hosting & Maintenance",
        input.displayDescription?.trim().slice(0, 2000) || null,
        input.notice?.trim().slice(0, 2000) || null,
        input.overdueWarning?.trim().slice(0, 2000) || null,
        Math.max(0, Math.min(31, Math.floor(input.dueDaysAfterMonthEnd))),
        Math.max(0, Math.min(31, Math.floor(input.graceDays))),
        input.enforcementEnabled,
      ],
    );
    const row = result.rows[0];
    return {
      configured: row.configured,
      enabled: row.enabled,
      minimumMonthlyFeeUsd: Number(row.minimum_monthly_fee_usd),
      maximumMonthlyFeeUsd: Number(row.maximum_monthly_fee_usd),
      displayTitle: row.display_title,
      displayDescription: row.display_description,
      notice: row.notice,
      overdueWarning: row.overdue_warning,
      dueDaysAfterMonthEnd: Number(row.due_days_after_month_end),
      graceDays: Number(row.grace_days),
      enforcementEnabled: row.enforcement_enabled,
    };
  }

  async getMonthOverride(monthKey = getBillingMonthKey()): Promise<ManagedHostingMonthOverride | null> {
    const result = await this.pool.query<{
      month_key: string;
      minimum_floor_usd: string | number;
      operator_note: string | null;
      payment_status: "PENDING" | "PAID" | "WAIVED";
      amount_due_usd: string | number | null;
      due_at: Date | string | null;
      grace_ends_at: Date | string | null;
    }>(
      `SELECT month_key, minimum_floor_usd, operator_note, payment_status,
              amount_due_usd, due_at, grace_ends_at
       FROM managed_hosting_months
       WHERE month_key = $1
       LIMIT 1`,
      [monthKey],
    );
    return result.rows[0] ? mapMonthRow(result.rows[0]) : null;
  }

  async getOldestOutstandingInvoice(): Promise<ManagedHostingMonthOverride | null> {
    const result = await this.pool.query<{
      month_key: string;
      minimum_floor_usd: string | number;
      operator_note: string | null;
      payment_status: "PENDING" | "PAID" | "WAIVED";
      amount_due_usd: string | number | null;
      due_at: Date | string | null;
      grace_ends_at: Date | string | null;
    }>(
      `SELECT month_key, minimum_floor_usd, operator_note, payment_status,
              amount_due_usd, due_at, grace_ends_at
       FROM managed_hosting_months
       WHERE payment_status = 'PENDING' AND finalized_at IS NOT NULL
       ORDER BY month_key ASC
       LIMIT 1`,
    );
    return result.rows[0] ? mapMonthRow(result.rows[0]) : null;
  }

  async finalizeMonthInvoice(input: {
    monthKey: string;
    minimumFloorUsd: number;
    amountDueUsd: number;
    dueAt: Date;
    graceEndsAt: Date;
  }): Promise<ManagedHostingMonthOverride> {
    const result = await this.pool.query<{
      month_key: string;
      minimum_floor_usd: string | number;
      operator_note: string | null;
      payment_status: "PENDING" | "PAID" | "WAIVED";
      amount_due_usd: string | number | null;
      due_at: Date | string | null;
      grace_ends_at: Date | string | null;
    }>(
      `INSERT INTO managed_hosting_months (
         month_key, minimum_floor_usd, operator_note, payment_status,
         amount_due_usd, due_at, grace_ends_at, finalized_at, created_at, updated_at
       ) VALUES ($1, $2, NULL, 'PENDING', $3, $4, $5, NOW(), NOW(), NOW())
       ON CONFLICT (month_key) DO UPDATE SET
         amount_due_usd = COALESCE(managed_hosting_months.amount_due_usd, EXCLUDED.amount_due_usd),
         due_at = COALESCE(managed_hosting_months.due_at, EXCLUDED.due_at),
         grace_ends_at = COALESCE(managed_hosting_months.grace_ends_at, EXCLUDED.grace_ends_at),
         finalized_at = COALESCE(managed_hosting_months.finalized_at, NOW()),
         updated_at = NOW()
       RETURNING month_key, minimum_floor_usd, operator_note, payment_status,
                 amount_due_usd, due_at, grace_ends_at`,
      [
        input.monthKey,
        Math.max(0, Math.round(input.minimumFloorUsd * 100) / 100),
        Math.max(0, Math.round(input.amountDueUsd * 100) / 100),
        input.dueAt,
        input.graceEndsAt,
      ],
    );
    return mapMonthRow(result.rows[0]);
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
      amount_due_usd: string | number | null;
      due_at: Date | string | null;
      grace_ends_at: Date | string | null;
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
       RETURNING month_key, minimum_floor_usd, operator_note, payment_status,
                 amount_due_usd, due_at, grace_ends_at`,
      [
        input.monthKey,
        Math.max(0, Math.round(input.minimumFloorUsd * 100) / 100),
        input.operatorNote?.trim().slice(0, 2000) || null,
        input.paymentStatus ?? "PENDING",
      ],
    );
    return mapMonthRow(result.rows[0]);
  }

  async markMonthPaid(input: {
    monthKey: string;
    defaultMinimumFloorUsd: number;
  }): Promise<ManagedHostingMonthOverride> {
    const result = await this.pool.query<{
      month_key: string;
      minimum_floor_usd: string | number;
      operator_note: string | null;
      payment_status: "PENDING" | "PAID" | "WAIVED";
      amount_due_usd: string | number | null;
      due_at: Date | string | null;
      grace_ends_at: Date | string | null;
    }>(
      `INSERT INTO managed_hosting_months (
         month_key, minimum_floor_usd, operator_note, payment_status, created_at, updated_at
       ) VALUES ($1, $2, NULL, 'PAID', NOW(), NOW())
       ON CONFLICT (month_key)
       DO UPDATE SET
         payment_status = 'PAID',
         updated_at = NOW()
       RETURNING month_key, minimum_floor_usd, operator_note, payment_status,
                 amount_due_usd, due_at, grace_ends_at`,
      [
        input.monthKey,
        Math.max(0, Math.round(input.defaultMinimumFloorUsd * 100) / 100),
      ],
    );
    return mapMonthRow(result.rows[0]);
  }
}
