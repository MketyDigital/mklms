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
  usdtTrc20Address?: string | null;
  usdtTonAddress?: string | null;
  notice?: string | null;
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
    usdtTrc20Address: input.usdtTrc20Address?.trim() || null,
    usdtTonAddress: input.usdtTonAddress?.trim() || null,
    notice: input.notice?.trim() || null,
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
