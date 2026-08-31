import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";

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
}
