import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresManagedHostingLedgerRepository } from "@/features/hosting/repositories/postgres-managed-hosting-ledger.repository";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import {
  canonicalBillingSettlementPayload,
  isFreshBillingTimestamp,
  verifyBillingPayload,
} from "@/features/hosting/server/billing-signature";
import { getEffectiveManagedHostingPolicy } from "@/features/hosting/server/managed-hosting-policy";

const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const baseSchema = z.object({
  installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  action: z.enum(["getPolicy","setPolicy","getMonth","setMonth","getAdjustments","addAdjustment"]),
  timestamp: z.number().int(),
}).passthrough();

export async function POST(request: Request) {
  const sharedSecret = process.env.MKLMS_BILLING_SHARED_SECRET?.trim();
  const expectedInstallationId = process.env.MKLMS_BILLING_INSTALLATION_ID?.trim();
  if (!sharedSecret || sharedSecret.length < 16 || !expectedInstallationId) {
    return NextResponse.json({ ok: false, message: "Billing operator control is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = baseSchema.safeParse(body);
  if (!parsed.success || parsed.data.installationId !== expectedInstallationId) {
    return NextResponse.json({ ok: false, message: "Invalid operator command." }, { status: 400 });
  }
  if (!isFreshBillingTimestamp(parsed.data.timestamp)) {
    return NextResponse.json({ ok: false, message: "Expired operator command." }, { status: 401 });
  }
  const signature = request.headers.get("x-mkety-billing-signature");
  if (!verifyBillingPayload(sharedSecret, canonicalBillingSettlementPayload(body), signature)) {
    return NextResponse.json({ ok: false, message: "Unauthorized operator command." }, { status: 401 });
  }

  const repository = new PostgresManagedHostingRepository();
  const ledger = new PostgresManagedHostingLedgerRepository();

  if (parsed.data.action === "getPolicy") {
    const [stored, effective] = await Promise.all([
      repository.getOperatorPolicy(),
      getEffectiveManagedHostingPolicy(repository),
    ]);
    return NextResponse.json({ ok: true, policy: stored ?? {
      configured: false,
      enabled: effective.policy.enabled,
      minimumMonthlyFeeUsd: effective.policy.minimumMonthlyFeeUsd,
      maximumMonthlyFeeUsd: effective.policy.maximumMonthlyFeeUsd,
      displayTitle: effective.displayTitle,
      displayDescription: effective.displayDescription,
      notice: effective.policy.notice ?? null,
      overdueWarning: effective.overdueWarning,
      dueDaysAfterMonthEnd: effective.dueDaysAfterMonthEnd,
      graceDays: effective.graceDays,
      enforcementEnabled: effective.enforcementEnabled,
    }});
  }

  if (parsed.data.action === "setPolicy") {
    const input = z.object({
      enabled: z.boolean(),
      minimumMonthlyFeeUsd: z.number().min(0).max(100000),
      maximumMonthlyFeeUsd: z.number().min(0).max(100000),
      displayTitle: z.string().trim().min(1).max(200),
      displayDescription: z.string().max(2000).nullable().optional(),
      notice: z.string().max(2000).nullable().optional(),
      overdueWarning: z.string().max(2000).nullable().optional(),
      dueDaysAfterMonthEnd: z.number().int().min(0).max(31),
      graceDays: z.number().int().min(0).max(31),
      enforcementEnabled: z.boolean(),
    }).safeParse(body);
    if (!input.success || input.data.maximumMonthlyFeeUsd < input.data.minimumMonthlyFeeUsd) {
      return NextResponse.json({ ok: false, message: "Invalid hosting policy." }, { status: 400 });
    }
    const policy = await repository.upsertOperatorPolicy(input.data);
    return NextResponse.json({ ok: true, policy });
  }

  if (parsed.data.action === "getMonth") {
    const input = z.object({ monthKey: monthKeySchema }).safeParse(body);
    if (!input.success) return NextResponse.json({ ok: false, message: "Invalid month." }, { status: 400 });
    const month = await repository.getMonthOverride(input.data.monthKey);
    return NextResponse.json({ ok: true, month });
  }

  if (parsed.data.action === "setMonth") {
    const input = z.object({
      monthKey: monthKeySchema,
      minimumFloorUsd: z.number().min(0).max(100000),
      operatorNote: z.string().max(2000).nullable().optional(),
      paymentStatus: z.enum(["PENDING","PAID","WAIVED"]),
    }).safeParse(body);
    if (!input.success) return NextResponse.json({ ok: false, message: "Invalid monthly billing details." }, { status: 400 });
    const month = await repository.upsertMonthOverride(input.data);
    return NextResponse.json({ ok: true, month });
  }

  if (parsed.data.action === "getAdjustments") {
    const input = z.object({ monthKey: monthKeySchema }).safeParse(body);
    if (!input.success) return NextResponse.json({ ok: false, message: "Invalid month." }, { status: 400 });
    const [entries, totalAdjustmentUsd] = await Promise.all([
      ledger.listMonth(input.data.monthKey),
      ledger.getMonthAdjustmentTotal(input.data.monthKey),
    ]);
    return NextResponse.json({ ok: true, entries, totalAdjustmentUsd });
  }

  const input = z.object({
    amountUsd: z.number().min(-100000).max(100000),
    reason: z.string().trim().min(3).max(1000),
  }).safeParse(body);
  if (!input.success) return NextResponse.json({ ok: false, message: "Invalid billing adjustment." }, { status: 400 });
  const entry = await ledger.setDailyOperatorAdjustment(input.data);
  return NextResponse.json({ ok: true, entry });
}
