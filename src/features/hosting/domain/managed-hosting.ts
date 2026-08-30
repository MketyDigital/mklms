export type HostingUsageEvidence = "MEASURED" | "ESTIMATED";
export type HostingUsageKind =
  | "COURSE_WATCH_MINUTES"
  | "LIVE_MEASURED_AUDIENCE_MINUTES"
  | "LIVE_BASELINE_AUDIENCE_MINUTES";

export interface ManagedHostingSettings {
  enabled: boolean;
  minimumMonthlyFeeUsd: number;
  maximumMonthlyFeeUsd: number;
  currentMonthlyFeeUsd: number;
  paymentNetwork: "TRC20" | "TON" | "CUSTOM";
  walletAddress: string;
  paymentNote?: string | null;
}

export function normalizeManagedHostingSettings(
  input: ManagedHostingSettings,
): ManagedHostingSettings {
  const minimumMonthlyFeeUsd = Math.max(0, Number(input.minimumMonthlyFeeUsd) || 0);
  const maximumMonthlyFeeUsd = Math.max(
    minimumMonthlyFeeUsd,
    Number(input.maximumMonthlyFeeUsd) || minimumMonthlyFeeUsd,
  );
  const currentMonthlyFeeUsd = Math.min(
    maximumMonthlyFeeUsd,
    Math.max(minimumMonthlyFeeUsd, Number(input.currentMonthlyFeeUsd) || minimumMonthlyFeeUsd),
  );

  return {
    ...input,
    minimumMonthlyFeeUsd,
    maximumMonthlyFeeUsd,
    currentMonthlyFeeUsd,
    walletAddress: input.walletAddress.trim(),
    paymentNote: input.paymentNote?.trim() || null,
  };
}

export function calculateManagedHostingFee(input: {
  watchMinutes: number;
  settings: ManagedHostingSettings;
}): number {
  const settings = normalizeManagedHostingSettings(input.settings);
  if (!settings.enabled) return 0;
  const watchMinutes = Math.max(0, Math.floor(input.watchMinutes));

  // Transparent service tiers. This is a managed-service fee, not a claim that
  // the infrastructure itself cost this amount.
  let ratio = 0;
  if (watchMinutes >= 150_000) ratio = 1;
  else if (watchMinutes >= 50_000) ratio = 0.7;
  else if (watchMinutes >= 10_000) ratio = 0.35;

  const fee =
    settings.minimumMonthlyFeeUsd +
    (settings.maximumMonthlyFeeUsd - settings.minimumMonthlyFeeUsd) * ratio;
  return Math.round(fee * 100) / 100;
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
