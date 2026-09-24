import { getMediaDb } from "./postgres";
import { DEFAULT_MEDIA_PLANS } from "../config/plans";

export async function ensureDefaultPlans() {
  const db = getMediaDb();
  for (const [index, plan] of DEFAULT_MEDIA_PLANS.entries()) {
    await db.query(
      "INSERT INTO media_plans (code,name,monthly_usd,storage_bytes,delivery_bytes,delivery_requests,logical_buckets,team_seats,max_object_bytes,overage_mode,dedicated_storage_eligible,active,display_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12) ON CONFLICT (code) DO NOTHING",
      [
        plan.code,
        plan.name,
        plan.monthlyUsd,
        plan.storageGb * 1024 ** 3,
        plan.deliveryGb * 1024 ** 3,
        plan.deliveryRequests,
        plan.logicalBuckets,
        plan.teamSeats,
        plan.maxObjectGb * 1024 ** 3,
        plan.overageMode,
        plan.dedicatedStorageEligible,
        index * 10,
      ],
    );
  }
}

export async function getPublicPlans() {
  await ensureDefaultPlans();
  const db = getMediaDb();
  const result = await db.query(
    "SELECT code,name,monthly_usd,storage_bytes,delivery_bytes,delivery_requests,logical_buckets,team_seats,max_object_bytes,overage_mode,dedicated_storage_eligible FROM media_plans WHERE active = true ORDER BY display_order, monthly_usd",
  );
  return result.rows;
}
