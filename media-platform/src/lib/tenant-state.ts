import { getMediaDb } from "./postgres";

export async function getTenantState(tenantId: string) {
  const db = getMediaDb();
  const row = await db.prepare(
    "SELECT t.id,t.slug,t.name,t.status,t.plan_code,p.name AS plan_name,p.monthly_usd,p.storage_bytes,p.delivery_bytes,p.delivery_requests,p.logical_buckets,p.team_seats,p.max_object_bytes,p.overage_mode,c.display_name,c.monthly_usd AS custom_monthly_usd,c.storage_bytes AS custom_storage_bytes,c.delivery_bytes AS custom_delivery_bytes,c.delivery_requests AS custom_delivery_requests,c.logical_buckets AS custom_logical_buckets,c.team_seats AS custom_team_seats,c.max_object_bytes AS custom_max_object_bytes,c.overage_mode AS custom_overage_mode,c.enterprise_features,c.infrastructure_mode,c.preferred_pool_key,c.billing_term_months,s.status AS subscription_status,s.current_period_end,COALESCE(w.balance_usd,0) AS prepaid_balance FROM media_tenants t JOIN media_plans p ON p.code=t.plan_code LEFT JOIN media_tenant_commercial_terms c ON c.tenant_id=t.id LEFT JOIN media_subscriptions s ON s.tenant_id=t.id LEFT JOIN media_prepaid_wallets w ON w.tenant_id=t.id WHERE t.id=? LIMIT 1"
  ).bind(tenantId).first<any>();
  if (!row) throw new Error("Tenant not found");

  const addons = await db.prepare(
    "SELECT COALESCE(SUM(storage_bytes),0) AS storage_bytes,COALESCE(SUM(delivery_bytes),0) AS delivery_bytes,COALESCE(SUM(delivery_requests),0) AS delivery_requests FROM media_tenant_addons WHERE tenant_id=? AND starts_at<=datetime('now') AND ends_at>datetime('now')"
  ).bind(tenantId).first<any>();

  const usage = await db.prepare(
    "SELECT COALESCE((SELECT SUM(size_bytes) FROM media_objects o JOIN media_buckets b ON b.id=o.bucket_id WHERE b.tenant_id=? AND o.status='ready'),0) AS storage_bytes,COALESCE((SELECT SUM(delivered_bytes) FROM media_usage_daily WHERE tenant_id=? AND usage_date>=date('now','start of month')),0) AS delivery_bytes,COALESCE((SELECT SUM(delivery_requests) FROM media_usage_daily WHERE tenant_id=? AND usage_date>=date('now','start of month')),0) AS delivery_requests,COALESCE((SELECT COUNT(*) FROM media_buckets WHERE tenant_id=?),0) AS bucket_count"
  ).bind(tenantId,tenantId,tenantId,tenantId).first<any>();

  return {
    id:String(row.id),
    slug:String(row.slug),
    name:String(row.name),
    status:String(row.status),
    subscriptionStatus:String(row.subscription_status ?? "pending"),
    planName:String(row.display_name || row.plan_name),
    monthlyUsd:Number(row.custom_monthly_usd ?? row.monthly_usd),
    storageLimitBytes:Number(row.custom_storage_bytes ?? row.storage_bytes)+Number(addons?.storage_bytes??0),
    deliveryLimitBytes:Number(row.custom_delivery_bytes ?? row.delivery_bytes)+Number(addons?.delivery_bytes??0),
    requestLimit:Number(row.custom_delivery_requests ?? row.delivery_requests)+Number(addons?.delivery_requests??0),
    addonStorageBytes:Number(addons?.storage_bytes??0),
    addonDeliveryBytes:Number(addons?.delivery_bytes??0),
    addonDeliveryRequests:Number(addons?.delivery_requests??0),
    bucketLimit:Number(row.custom_logical_buckets ?? row.logical_buckets),
    teamSeats:Number(row.custom_team_seats ?? row.team_seats),
    maxObjectBytes:Number(row.custom_max_object_bytes ?? row.max_object_bytes),
    overageMode:String(row.custom_overage_mode ?? row.overage_mode),
    enterpriseFeatures:Boolean(row.enterprise_features),
    infrastructureMode:String(row.infrastructure_mode ?? "automatic"),
    preferredPoolKey:row.preferred_pool_key ? String(row.preferred_pool_key) : null,
    billingTermMonths:Number(row.billing_term_months ?? 1),
    renewalAt:row.current_period_end ? String(row.current_period_end) : null,
    prepaidBalanceUsd:Number(row.prepaid_balance ?? 0),
    storageUsedBytes:Number(usage?.storage_bytes ?? 0),
    deliveryUsedBytes:Number(usage?.delivery_bytes ?? 0),
    requestsUsed:Number(usage?.delivery_requests ?? 0),
    bucketsUsed:Number(usage?.bucket_count ?? 0),
  };
}
