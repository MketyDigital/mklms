import { getMediaDb } from "./postgres";

export async function getTenantState(tenantId: string) {
  const db = getMediaDb();
  const result = await db.query(
    "SELECT t.id,t.slug,t.name,t.status,t.plan_code,p.name AS plan_name,p.monthly_usd,p.storage_bytes,p.delivery_bytes,p.delivery_requests,p.logical_buckets,p.team_seats,p.max_object_bytes,p.overage_mode,c.display_name,c.monthly_usd AS custom_monthly_usd,c.storage_bytes AS custom_storage_bytes,c.delivery_bytes AS custom_delivery_bytes,c.delivery_requests AS custom_delivery_requests,c.logical_buckets AS custom_logical_buckets,c.team_seats AS custom_team_seats,c.max_object_bytes AS custom_max_object_bytes,c.overage_mode AS custom_overage_mode,c.enterprise_features,c.infrastructure_mode,c.billing_term_months,s.status AS subscription_status,s.current_period_end,COALESCE(w.balance_usd,0) AS prepaid_balance FROM media_tenants t JOIN media_plans p ON p.code=t.plan_code LEFT JOIN media_tenant_commercial_terms c ON c.tenant_id=t.id LEFT JOIN media_subscriptions s ON s.tenant_id=t.id LEFT JOIN media_prepaid_wallets w ON w.tenant_id=t.id WHERE t.id=$1 LIMIT 1",
    [tenantId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Tenant not found");

  const usage = await db.query(
    "SELECT COALESCE((SELECT SUM(size_bytes) FROM media_objects o JOIN media_buckets b ON b.id=o.bucket_id WHERE b.tenant_id=$1 AND o.status='ready'),0)::bigint AS storage_bytes, COALESCE((SELECT SUM(delivered_bytes) FROM media_usage_daily WHERE tenant_id=$1 AND usage_date >= date_trunc('month',current_date)),0)::bigint AS delivery_bytes, COALESCE((SELECT SUM(delivery_requests) FROM media_usage_daily WHERE tenant_id=$1 AND usage_date >= date_trunc('month',current_date)),0)::bigint AS delivery_requests, COALESCE((SELECT COUNT(*) FROM media_buckets WHERE tenant_id=$1),0)::int AS bucket_count",
    [tenantId],
  );
  const u = usage.rows[0];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    subscriptionStatus: row.subscription_status ?? "pending",
    planName: row.display_name || row.plan_name,
    monthlyUsd: Number(row.custom_monthly_usd ?? row.monthly_usd),
    storageLimitBytes: Number(row.custom_storage_bytes ?? row.storage_bytes),
    deliveryLimitBytes: Number(row.custom_delivery_bytes ?? row.delivery_bytes),
    requestLimit: Number(row.custom_delivery_requests ?? row.delivery_requests),
    bucketLimit: Number(row.custom_logical_buckets ?? row.logical_buckets),
    teamSeats: Number(row.custom_team_seats ?? row.team_seats),
    maxObjectBytes: Number(row.custom_max_object_bytes ?? row.max_object_bytes),
    overageMode: row.custom_overage_mode ?? row.overage_mode,
    enterpriseFeatures: Boolean(row.enterprise_features),
    infrastructureMode: row.infrastructure_mode ?? "automatic",
    billingTermMonths: Number(row.billing_term_months ?? 1),
    renewalAt: row.current_period_end,
    prepaidBalanceUsd: Number(row.prepaid_balance ?? 0),
    storageUsedBytes: Number(u.storage_bytes ?? 0),
    deliveryUsedBytes: Number(u.delivery_bytes ?? 0),
    requestsUsed: Number(u.delivery_requests ?? 0),
    bucketsUsed: Number(u.bucket_count ?? 0),
  };
}
