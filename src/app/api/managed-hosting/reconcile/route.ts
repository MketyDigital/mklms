import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { signBillingPayload } from "@/features/hosting/server/billing-signature";

const schema = z.object({
  monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  paymentId: z.string().trim().min(1).max(128),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const serviceUrl = process.env.MKLMS_BILLING_SERVICE_URL?.trim();
  const installationId = process.env.MKLMS_BILLING_INSTALLATION_ID?.trim();
  const sharedSecret = process.env.MKLMS_BILLING_SHARED_SECRET?.trim();
  if (!serviceUrl || !installationId || !sharedSecret || sharedSecret.length < 16) {
    return NextResponse.json({ ok: false, message: "Automatic billing is not configured." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Enter a valid billing month and NOWPayments payment ID." }, { status: 400 });
  }

  let endpoint: URL;
  try {
    const base = new URL(serviceUrl);
    if (base.protocol !== "https:") throw new Error("Billing service must use HTTPS.");
    endpoint = new URL("v1/reconcile", base.toString().endsWith("/") ? base : base.toString() + "/");
  } catch {
    return NextResponse.json({ ok: false, message: "Automatic billing is not configured." }, { status: 503 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(12).toString("base64url");
  const body = {
    installationId,
    monthKey: parsed.data.monthKey,
    paymentId: parsed.data.paymentId,
    timestamp,
    nonce,
  };
  const canonical = JSON.stringify(
    Object.fromEntries(Object.entries(body).sort(([left], [right]) => left.localeCompare(right))),
  );
  const signature = signBillingPayload(sharedSecret, canonical);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...body, signature }),
  });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { ok: false, message: "Invalid billing-service response." }, { status: response.status });
}
