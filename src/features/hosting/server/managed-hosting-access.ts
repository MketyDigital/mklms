import {
  calculateManagedHostingAmountDue,
  getBillingMonthKey,
  resolveManagedHostingStanding,
  type ManagedHostingStandingStatus,
} from "../domain/managed-hosting";
import { PostgresManagedHostingRepository } from "../repositories/postgres-managed-hosting.repository";
import { getEffectiveManagedHostingPolicy } from "./managed-hosting-policy";

export interface ManagedHostingServiceAccess {
  allowed: boolean;
  status: ManagedHostingStandingStatus | "CURRENT" | "UNAVAILABLE";
  monthKey?: string;
  amountDueUsd?: number;
  dueAt?: Date;
  graceEndsAt?: Date;
  warning?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function previousMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

function lastDayOfMonth(monthStart: Date): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export async function ensurePreviousManagedHostingInvoice(
  repository = new PostgresManagedHostingRepository(),
  now = new Date(),
) {
  const effective = await getEffectiveManagedHostingPolicy(repository);
  if (!effective.policy.enabled) return null;

  const monthStart = previousMonthStart(now);
  const monthKey = getBillingMonthKey(monthStart);
  const existing = await repository.getMonthOverride(monthKey);
  if (existing?.amountDueUsd != null && existing.dueAt && existing.graceEndsAt) return existing;

  const usage = await repository.getUsageForMonth(monthStart);
  const monthEnd = lastDayOfMonth(monthStart);
  const billing = calculateManagedHostingAmountDue({
    watchMinutes: usage.courseWatchMinutesMeasured + usage.liveAudienceMinutesEstimated,
    policy: effective.policy,
    monthlyMinimumFloorUsd: existing?.minimumFloorUsd,
    now: monthEnd,
  });

  const dueAt = new Date(monthEnd.getTime() + effective.dueDaysAfterMonthEnd * DAY_MS);
  const graceEndsAt = new Date(dueAt.getTime() + effective.graceDays * DAY_MS);

  return repository.finalizeMonthInvoice({
    monthKey,
    minimumFloorUsd: existing?.minimumFloorUsd ?? effective.policy.minimumMonthlyFeeUsd,
    amountDueUsd: billing.amountDueUsd,
    dueAt,
    graceEndsAt,
  });
}

export async function getManagedHostingServiceAccess(
  repository = new PostgresManagedHostingRepository(),
  now = new Date(),
): Promise<ManagedHostingServiceAccess> {
  try {
    const effective = await getEffectiveManagedHostingPolicy(repository);
    if (!effective.policy.enabled) return { allowed: true, status: "CURRENT" };

    await ensurePreviousManagedHostingInvoice(repository, now);
    const invoice = await repository.getOldestOutstandingInvoice();
    if (!invoice || !invoice.dueAt || !invoice.graceEndsAt || invoice.amountDueUsd == null) {
      return { allowed: true, status: "CURRENT" };
    }

    const standing = resolveManagedHostingStanding({
      paymentStatus: invoice.paymentStatus,
      dueAt: invoice.dueAt,
      graceEndsAt: invoice.graceEndsAt,
      enforcementEnabled: effective.enforcementEnabled,
      now,
    });

    return {
      allowed: !standing.restricted,
      status: standing.status,
      monthKey: invoice.monthKey,
      amountDueUsd: invoice.amountDueUsd,
      dueAt: invoice.dueAt,
      graceEndsAt: invoice.graceEndsAt,
      warning: effective.overdueWarning,
    };
  } catch {
    // Commercial enforcement must never create an infrastructure outage if the
    // billing schema/service is temporarily unavailable.
    return { allowed: true, status: "UNAVAILABLE" };
  }
}
