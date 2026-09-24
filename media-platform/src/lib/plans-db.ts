import { getMediaDb } from "./postgres";

export async function getPublicPlans() {
  const result = await getMediaDb().prepare(
    "SELECT code,name,monthly_usd,storage_bytes,delivery_bytes,delivery_requests,logical_buckets,team_seats,max_object_bytes,overage_mode,dedicated_storage_eligible FROM media_plans WHERE active=1 ORDER BY display_order,monthly_usd"
  ).all<any>();
  return result.results ?? [];
}
