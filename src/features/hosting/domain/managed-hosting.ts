export type HostingUsageEvidence = "MEASURED" | "ESTIMATED";
export type HostingUsageKind =
  | "COURSE_WATCH_MINUTES"
  | "LIVE_MEASURED_AUDIENCE_MINUTES"
  | "LIVE_BASELINE_AUDIENCE_MINUTES";

export interface ManagedHostingPolicy {
  enabled: boolean;
  minimumMonthlyFeeUsd: number;
  maximumMonthlyFeeUsd: number;
  paymentUrl?: string | null;
  notice?: string | null;
  usdtNetwork?: string | null;
  usdtAddress?: string | null;
}

export interface ManagedHostingMonthOverride {
  monthKey: string;
  minimumFloorUsd: number;
  operatorNote?: string | null;
  paymentStatus: "PENDING" | "PAID" | "WAIVED";
}

export function normalizeManagedHostingPolicy(
  input: ManagedHostingPolicy,
): ManagedHostingPolicy {
  const minimumMonthlyFeeUsd = Math.max(15, Number(input.minimumMonthlyFeeUsd) || 15);
  const maximumMonthlyFeeUsd = Math.max(
    minimumMonthlyFeeUsd,
    Number(input.maximumMonthlyFeeUsd) || 50,
  );

  return {
    enabled: Boolean(input.enabled),
    minimumMonthlyFeeUsd,
    maximumMonthlyFeeUsd,
    paymentUrl: input.paymentUrl?.trim() || null,
    notice: input.notice?.trim() || null,
    usdtNetwork: input.usdtNetwork?.trim().slice(0, 40) || null,
    usdtAddress: input.usdtAddress?.trim().slice(0, 200) || null,
  };
}

export function calculateManagedHostingFee(input: {
  watchMinutes: number;
  policy: ManagedHostingPolicy;
}): number {
  const policy = normalizeManagedHostingPolicy(input.policy);
  if (!policy.enabled) return 0;
  const watchMinutes = Math.max(0, Math.floor(input.watchMinutes));

  let ratio = 0;
  if (watchMinutes >= 150_000) ratio = 1;
  else if (watchMinutes >= 50_000) ratio = 0.7;
  else if (watchMinutes >= 10_000) ratio = 0.35;

  const fee =
    policy.minimumMonthlyFeeUsd +
    (policy.maximumMonthlyFeeUsd - policy.minimumMonthlyFeeUsd) * ratio;
  return Math.round(fee * 100) / 100;
}

export function calculateManagedHostingAmountDue(input: {
  watchMinutes: number;
  policy: ManagedHostingPolicy;
  monthlyMinimumFloorUsd?: number | null;
}): { usageDerivedFeeUsd: number; minimumFloorUsd: number; amountDueUsd: number } {
  const policy = normalizeManagedHostingPolicy(input.policy);
  if (!policy.enabled) {
    return { usageDerivedFeeUsd: 0, minimumFloorUsd: 0, amountDueUsd: 0 };
  }

  const usageDerivedFeeUsd = calculateManagedHostingFee({
    watchMinutes: input.watchMinutes,
    policy,
  });
  const requestedFloor = Number(input.monthlyMinimumFloorUsd);
  const minimumFloorUsd = Number.isFinite(requestedFloor) && requestedFloor >= 0
    ? Math.round(requestedFloor * 100) / 100
    : policy.minimumMonthlyFeeUsd;
  const amountDueUsd = Math.max(minimumFloorUsd, usageDerivedFeeUsd);

  return {
    usageDerivedFeeUsd,
    minimumFloorUsd,
    amountDueUsd: Math.round(amountDueUsd * 100) / 100,
  };
}

export function getBillingMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function summarizeUsageMetric(input: {
  kind: HostingUsageKind;
  value: number;
}): { label: string; value: number; evidence: HostingUsageEvidence } {
  const value = Math.max(0, Math.round(input.value));
  switch (input.kind) {
    case "COURSE_WATCH_MINUTES":
      return { label: "Course watch minutes", value, evidence: "MEASURED" };
    case "LIVE_MEASURED_AUDIENCE_MINUTES":
      return { label: "Live audience-minutes", value, evidence: "MEASURED" };
    case "LIVE_BASELINE_AUDIENCE_MINUTES":
      return { label: "Live audience-minutes", value, evidence: "ESTIMATED" };
  }
}
