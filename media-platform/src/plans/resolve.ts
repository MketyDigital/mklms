import { DEFAULT_MEDIA_PLANS, type MediaPlan } from "../config/plans";

export type TenantCommercialOverride = Partial<Omit<MediaPlan, "code">> & {
  billingLabel?: string;
};

export function resolveTenantPlan(
  baseCode: string,
  override?: TenantCommercialOverride | null,
): MediaPlan & { billingLabel?: string } {
  const base = DEFAULT_MEDIA_PLANS.find((plan) => plan.code === baseCode);
  if (!base) throw new Error("Unknown base plan");
  return { ...base, ...(override ?? {}) };
}

// Example Starpips launch offer:
// baseCode: "starter"
// override: {
//   name: "Starpips Launch",
//   monthlyUsd: 3,
//   storageGb: 10,
//   deliveryGb: 100,
//   deliveryRequests: 1_000_000,
//   logicalBuckets: 3,
//   teamSeats: 1,
//   maxObjectGb: 2,
//   billingLabel: "Private launch offer",
// }
// This demonstrates that an operator can give any customer enterprise-style
// custom commercial terms without exposing a separate public plan.
