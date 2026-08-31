import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import {
  canonicalBillingSettlementPayload,
  isFreshBillingTimestamp,
  verifyBillingPayload,
} from "@/features/hosting/server/billing-signature";
import { getManagedHostingPolicy } from "@/features/hosting/server/managed-hosting-policy";

const settlementSchema = z.object({
  installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  paymentId: z.string().min(1).max(128),
  paymentStatus: z.literal("finished"),
  priceAmount: z.number().positive().max(100000),
  priceCurrency: z.string().min(1).max(16),
  actuallyPaid: z.number().nonnegative(),
  payCurrency: z.string().max(32),
  timestamp: z.number().int(),
});

export async function POST(request: Request) {
  const sharedSecret = process.env.MKLMS_BILLING_SHARED_SECRET?.trim();
  const expectedInstallationId = process.env.MKLMS_BILLING_INSTALLATION_ID?.trim();
  if (!sharedSecret || sharedSecret.length < 16 || !expectedInstallationId) {
    return NextResponse.json({ ok: false, message: "Billing settlement is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = settlementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid settlement." }, { status: 400 });
  }
  if (parsed.data.installationId !== expectedInstallationId) {
    return NextResponse.json({ ok: false, message: "Unknown installation." }, { status: 403 });
  }
  if (!isFreshBillingTimestamp(parsed.data.timestamp)) {
    return NextResponse.json({ ok: false, message: "Expired settlement." }, { status: 401 });
  }

  const signature = request.headers.get("x-mkety-billing-signature");
  const canonical = canonicalBillingSettlementPayload(parsed.data);
  if (!verifyBillingPayload(sharedSecret, canonical, signature)) {
    return NextResponse.json({ ok: false, message: "Unauthorized settlement." }, { status: 401 });
  }

  const policy = getManagedHostingPolicy();
  const month = await new PostgresManagedHostingRepository().markMonthPaid({
    monthKey: parsed.data.monthKey,
    defaultMinimumFloorUsd: policy.minimumMonthlyFeeUsd,
  });

  return NextResponse.json({ ok: true, month });
}
