import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import {
  calculateManagedHostingAmountDue,
  getBillingMonthKey,
} from "@/features/hosting/domain/managed-hosting";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import { ensurePreviousManagedHostingInvoice } from "@/features/hosting/server/managed-hosting-access";
import {
  canonicalBillingCheckoutPayload,
  signBillingPayload,
} from "@/features/hosting/server/billing-signature";
import { getEffectiveManagedHostingPolicy } from "@/features/hosting/server/managed-hosting-policy";

export async function POST() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const serviceUrl = process.env.MKLMS_BILLING_SERVICE_URL?.trim();
  const installationId = process.env.MKLMS_BILLING_INSTALLATION_ID?.trim();
  const sharedSecret = process.env.MKLMS_BILLING_SHARED_SECRET?.trim();
  if (!serviceUrl || !installationId || !sharedSecret || sharedSecret.length < 16) {
    return NextResponse.json({ ok: false, message: "Automatic billing is not configured." }, { status: 503 });
  }

  let invoiceEndpoint: URL;
  try {
    const base = new URL(serviceUrl);
    if (base.protocol !== "https:") throw new Error("Billing service must use HTTPS.");
    invoiceEndpoint = new URL("v1/invoices", base.toString().endsWith("/") ? base : `${base.toString()}/`);
  } catch {
    return NextResponse.json({ ok: false, message: "Automatic billing is not configured." }, { status: 503 });
  }

  const repository = new PostgresManagedHostingRepository();
  const effective = await getEffectiveManagedHostingPolicy(repository);
  const policy = effective.policy;
  if (!policy.enabled) {
    return NextResponse.json({ ok: false, message: "Managed hosting is not enabled." }, { status: 409 });
  }

  await ensurePreviousManagedHostingInvoice(repository);
  const outstanding = await repository.getOldestOutstandingInvoice();

  let monthKey: string;
  let amountUsd: number;

  if (outstanding?.amountDueUsd != null && outstanding.amountDueUsd > 0) {
    monthKey = outstanding.monthKey;
    amountUsd = outstanding.amountDueUsd;
  } else {
    const usage = await repository.getCurrentMonthUsage();
    monthKey = getBillingMonthKey(usage.monthStart);
    const monthOverride = await repository.getMonthOverride(monthKey);
    if (monthOverride?.paymentStatus === "PAID") {
      return NextResponse.json({ ok: false, message: "This month is already paid." }, { status: 409 });
    }
    if (monthOverride?.paymentStatus === "WAIVED") {
      return NextResponse.json({ ok: false, message: "This month has been waived." }, { status: 409 });
    }

    const billing = calculateManagedHostingAmountDue({
      watchMinutes: usage.courseWatchMinutesMeasured + usage.liveAudienceMinutesEstimated,
      policy,
      monthlyMinimumFloorUsd: monthOverride?.minimumFloorUsd,
    });
    if (billing.amountDueUsd <= 0) {
      return NextResponse.json({ ok: false, message: "There is no amount due." }, { status: 409 });
    }
    amountUsd = billing.amountDueUsd;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(12).toString("base64url");
  const requestBody = {
    installationId,
    monthKey,
    amountUsd,
    timestamp,
    nonce,
  };
  const signature = signBillingPayload(
    sharedSecret,
    canonicalBillingCheckoutPayload(requestBody),
  );

  const billingResponse = await fetch(invoiceEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...requestBody, signature }),
  });
  const payload = (await billingResponse.json().catch(() => null)) as {
    ok?: boolean;
    invoiceUrl?: string;
    message?: string;
  } | null;

  if (!billingResponse.ok || !payload?.invoiceUrl) {
    return NextResponse.json(
      { ok: false, message: payload?.message ?? "Could not create payment invoice." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, invoiceUrl: payload.invoiceUrl, monthKey, amountUsd });
}
