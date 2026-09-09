export type HostingUsageEvidence = "MEASURED" | "ESTIMATED";
export type HostingUsageKind =
  | "COURSE_WATCH_MINUTES"
  | "LIVE_MEASURED_AUDIENCE_MINUTES"
  | "LIVE_BASELINE_AUDIENCE_MINUTES";

export type StreamingActivityBand = "Low" | "High";

export interface ManagedHostingUsageSignals {
  courseWatchMinutesMeasured?: number;
  protectedPlaybackViewsMeasured?: number;
  uniqueViewersMeasured?: number;
  liveAudienceMinutesMeasured?: number;
  liveAudienceMinutesEstimated?: number;
  estimatedStreamingActivityUnits?: number;
  portalVisits?: number;
}

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

function nonNegative(value: number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
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
 * Converts mixed streaming evidence into an internal equivalent-usage score.
 * Video consumption dominates. Ordinary authenticated portal visits have a
 * deliberately small weight and can never masquerade as measured watch time.
 */
export function calculateWeightedStreamingUsage(
  signals: ManagedHostingUsageSignals,
): number {
  return Math.round(
    nonNegative(signals.courseWatchMinutesMeasured) +
      nonNegative(signals.liveAudienceMinutesMeasured) * 0.9 +
      nonNegative(signals.liveAudienceMinutesEstimated) * 0.75 +
      nonNegative(signals.protectedPlaybackViewsMeasured) * 8 +
      nonNegative(signals.uniqueViewersMeasured) * 15 +
      nonNegative(signals.estimatedStreamingActivityUnits) * 120 +
      nonNegative(signals.portalVisits) * 0.3,
  );
}

export function getStreamingActivityBand(
  signals: ManagedHostingUsageSignals,
): StreamingActivityBand {
  return calculateWeightedStreamingUsage(signals) >= 10_000 ? "High" : "Low";
}

function usageRatio(equivalentUsage: number): number {
  if (equivalentUsage <= 0) return 0;
  if (equivalentUsage < 10_000) return 0.35 * (equivalentUsage / 10_000);
  if (equivalentUsage < 50_000) {
    return 0.35 + 0.35 * ((equivalentUsage - 10_000) / 40_000);
  }
  if (equivalentUsage < 150_000) {
    return 0.7 + 0.3 * ((equivalentUsage - 50_000) / 100_000);
  }
  return 1;
}

/** Usage-derived managed-service amount before the calendar floor is applied. */
export function calculateManagedHostingFee(input: {
  watchMinutes: number;
  policy: ManagedHostingPolicy;
  usageSignals?: ManagedHostingUsageSignals;
}): number {
  const policy = normalizeManagedHostingPolicy(input.policy);
  if (!policy.enabled) return 0;

  if (!input.usageSignals) {
    const watchMinutes = Math.max(0, Math.floor(input.watchMinutes));
    let ratio = 0;
    if (watchMinutes >= 150_000) ratio = 1;
    else if (watchMinutes >= 50_000) ratio = 0.7;
    else if (watchMinutes >= 10_000) ratio = 0.35;
    return roundUsd(policy.maximumMonthlyFeeUsd * ratio);
  }

  const equivalentUsage = calculateWeightedStreamingUsage(input.usageSignals);
  return roundUsd(policy.maximumMonthlyFeeUsd * usageRatio(equivalentUsage));
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
  usageSignals?: ManagedHostingUsageSignals;
  operatorAdjustmentUsd?: number | null;
  now?: Date;
}): {
  usageDerivedFeeUsd: number;
  minimumFloorUsd: number;
  accruedMinimumUsd: number;
  operatorAdjustmentUsd: number;
  amountDueUsd: number;
} {
  const policy = normalizeManagedHostingPolicy(input.policy);
  if (!policy.enabled) {
    return {
      usageDerivedFeeUsd: 0,
      minimumFloorUsd: 0,
      accruedMinimumUsd: 0,
      operatorAdjustmentUsd: 0,
      amountDueUsd: 0,
    };
  }

  const usageDerivedFeeUsd = calculateManagedHostingFee({
    watchMinutes: input.watchMinutes,
    policy,
    usageSignals: input.usageSignals,
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
  const rawAdjustment = Number(input.operatorAdjustmentUsd);
  const operatorAdjustmentUsd = Number.isFinite(rawAdjustment) ? roundUsd(rawAdjustment) : 0;
  const amountDueUsd = Math.max(0, Math.max(minimumFloorUsd, usageDerivedFeeUsd) + operatorAdjustmentUsd);

  return {
    usageDerivedFeeUsd,
    minimumFloorUsd,
    accruedMinimumUsd,
    operatorAdjustmentUsd,
    amountDueUsd: roundUsd(amountDueUsd),
  };
}

export function resolveManagedHostingPaymentWindow(now = new Date()): {
  isOpen: boolean;
  opensAt: Date;
  openDay: number;
} {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const openDay = month === 1 ? lastDay : Math.min(30, lastDay);
  const opensAt = new Date(Date.UTC(year, month, openDay, 0, 0, 0));
  return { isOpen: now.getTime() >= opensAt.getTime(), opensAt, openDay };
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
