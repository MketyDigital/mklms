import { normalizeSafeExternalUrl } from "@/lib/security/external-url";
import {
  normalizeManagedHostingPolicy,
  type ManagedHostingPolicy,
} from "../domain/managed-hosting";
import {
  PostgresManagedHostingRepository,
  type ManagedHostingOperatorPolicyRecord,
} from "../repositories/postgres-managed-hosting.repository";

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isManagedHostingBillingAutomationConfigured(): boolean {
  const serviceUrl = process.env.MKLMS_BILLING_SERVICE_URL?.trim();
  const installationId = process.env.MKLMS_BILLING_INSTALLATION_ID?.trim();
  const secret = process.env.MKLMS_BILLING_SHARED_SECRET?.trim();
  if (!serviceUrl || !installationId || !secret || secret.length < 16) return false;
  try {
    return new URL(serviceUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export function getManagedHostingPolicy(): ManagedHostingPolicy {
  let paymentUrl: string | null = null;
  try {
    paymentUrl = normalizeSafeExternalUrl(process.env.MKLMS_MANAGED_PAYMENT_URL);
  } catch {
    paymentUrl = null;
  }

  return normalizeManagedHostingPolicy({
    enabled: process.env.MKLMS_MANAGED_HOSTING_ENABLED === "true",
    minimumMonthlyFeeUsd: parseNumber(process.env.MKLMS_MANAGED_HOSTING_MIN_USD, 15),
    maximumMonthlyFeeUsd: parseNumber(process.env.MKLMS_MANAGED_HOSTING_MAX_USD, 50),
    paymentUrl,
    notice: process.env.MKLMS_MANAGED_HOSTING_NOTICE?.slice(0, 2000) ?? null,
  });
}

export interface EffectiveManagedHostingPolicy {
  policy: ManagedHostingPolicy;
  displayTitle: string;
  displayDescription: string | null;
  overdueWarning: string | null;
  dueDaysAfterMonthEnd: number;
  graceDays: number;
  enforcementEnabled: boolean;
  source: "OPERATOR" | "ENVIRONMENT";
}

const DEFAULT_DESCRIPTION =
  "Managed video hosting, protected delivery, live-video infrastructure and platform maintenance.";
const DEFAULT_OVERDUE_WARNING =
  "Your managed video hosting and maintenance payment is overdue. Please pay to avoid interruption of hosted video services.";

export async function getEffectiveManagedHostingPolicy(
  repository = new PostgresManagedHostingRepository(),
): Promise<EffectiveManagedHostingPolicy> {
  const environment = getManagedHostingPolicy();
  let operator: ManagedHostingOperatorPolicyRecord | null = null;
  try {
    operator = await repository.getOperatorPolicy();
  } catch {
    operator = null;
  }

  if (!operator?.configured) {
    return {
      policy: environment,
      displayTitle: "Managed Video Hosting & Maintenance",
      displayDescription: DEFAULT_DESCRIPTION,
      overdueWarning: DEFAULT_OVERDUE_WARNING,
      dueDaysAfterMonthEnd: 5,
      graceDays: 5,
      enforcementEnabled: true,
      source: "ENVIRONMENT",
    };
  }

  return {
    policy: normalizeManagedHostingPolicy({
      enabled: operator.enabled,
      minimumMonthlyFeeUsd: operator.minimumMonthlyFeeUsd,
      maximumMonthlyFeeUsd: operator.maximumMonthlyFeeUsd,
      paymentUrl: environment.paymentUrl,
      notice: operator.notice,
    }),
    displayTitle: operator.displayTitle,
    displayDescription: operator.displayDescription || DEFAULT_DESCRIPTION,
    overdueWarning: operator.overdueWarning || DEFAULT_OVERDUE_WARNING,
    dueDaysAfterMonthEnd: operator.dueDaysAfterMonthEnd,
    graceDays: operator.graceDays,
    enforcementEnabled: operator.enforcementEnabled,
    source: "OPERATOR",
  };
}
