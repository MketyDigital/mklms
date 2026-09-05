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
}

export interface ManagedHostingMonthOverride {
  monthKey: string;
  minimumFloorUsd: number;
  operatorNote?: string | null;
  paymentStatus: "PENDING" | "PAID" | "WAIVED";
  amountDueUsd?: number | null;
  dueAt?: Date | null;
  graceEndsAt?: Date | null;
}

export type ManagedHostingStandingStatus =
  | "DUE"
  | "OVERDUE"
  | "RESTRICTED"
  | "PAID"
  | "WAIVED";

export function resolveManagedHostingStanding(input: {
  paymentStatus: "PENDING" | "PAID" | "WAIVED";
  dueAt: Date;
  graceEndsAt: Date;
  enforcementEnabled: boolean;
  now?: Date;
}): { status: ManagedHostingStandingStatus; restricted: boolean } {
  if (input.paymentStatus === "PAID") return { status: "PAID", restricted: false };
  if (input.paymentStatus === "WAIVED") return { status: "WAIVED", restricted: false };

  const now = input.now ?? new Date();
  if (now <= input.dueAt) return { status: "DUE", restricted: false };
  if (now <= input.graceEndsAt || !input.enforcementEnabled) {
    return { status: "OVERDUE", restricted: false };
  }
  return { status: "RESTRICTED", restricted: true };
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeManagedHostingPolicy(
  input: ManagedHostingPolicy,
): ManagedHostingPolicy {
  const rawMinimum = Number(input.minimumMonthlyFeeUsd);
  const minimumMonthlyFeeUsd = Number.isFinite(rawMinimum)
    ? Math.max(0, rawMinimum)
    : 15;
  const rawMaximum = Number(input.maximumMonthlyFeeUsd);
  const maximumMonthlyFeeUsd = Number.isFinite(rawMaximum)
    ? Math.max(minimumMonthlyFeeUsd, rawMaximum)
    : Math.max(minimumMonthlyFeeUsd, 50);

  return {
    enabled: Boolean(input.enabled),
    minimumMonthlyFeeUsd,
    maximumMonthlyFeeUsd,
    paymentUrl: input.paymentUrl?.trim() || null,
    notice: input.notice?.trim() || null,
  };
}

/**
 * Usage-derived managed-service amount before the calendar minimum is applied.
 * The configured monthly minimum is intentionally NOT added here: it accrues
 * separately through the calendar month in calculateManagedHostingAmountDue().
 */
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

  return roundUsd(policy.maximumMonthlyFeeUsd * ratio);
}

export function calculateAccruedMonthlyMinimum(input: {
  policy: ManagedHostingPolicy;
  now?: Date;
}): number {
  const policy = normalizeManagedHostingPolicy(input.policy);
  if (!policy.enabled) return 0;

  const now = input.now ?? new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return roundUsd(policy.minimumMonthlyFeeUsd * (day / daysInMonth));
}

export function calculateManagedHostingAmountDue(input: {
  watchMinutes: number;
  policy: ManagedHostingPolicy;
  monthlyMinimumFloorUsd?: number | null;
  now?: Date;
}): {
  usageDerivedFeeUsd: number;
  minimumFloorUsd: number;
  accruedMinimumUsd: number;
  amountDueUsd: number;
} {
  const policy = normalizeManagedHostingPolicy(input.policy);
  if (!policy.enabled) {
    return {
      usageDerivedFeeUsd: 0,
      minimumFloorUsd: 0,
      accruedMinimumUsd: 0,
      amountDueUsd: 0,
    };
  }

  const usageDerivedFeeUsd = calculateManagedHostingFee({
    watchMinutes: input.watchMinutes,
    policy,
  });
  const accruedMinimumUsd = calculateAccruedMonthlyMinimum({
    policy,
    now: input.now,
  });

  const requestedFloor = Number(input.monthlyMinimumFloorUsd);
  const hasExplicitHigherFloor =
    Number.isFinite(requestedFloor) && requestedFloor > policy.minimumMonthlyFeeUsd;
  const minimumFloorUsd = hasExplicitHigherFloor
    ? roundUsd(requestedFloor)
    : accruedMinimumUsd;
  const amountDueUsd = Math.max(minimumFloorUsd, usageDerivedFeeUsd);

  return {
    usageDerivedFeeUsd,
    minimumFloorUsd,
    accruedMinimumUsd,
    amountDueUsd: roundUsd(amountDueUsd),
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
