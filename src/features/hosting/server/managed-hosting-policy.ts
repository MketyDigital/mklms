import { normalizeSafeExternalUrl } from "@/lib/security/external-url";
import {
  normalizeManagedHostingPolicy,
  type ManagedHostingPolicy,
} from "../domain/managed-hosting";

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
