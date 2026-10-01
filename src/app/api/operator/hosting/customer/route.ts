import { NextResponse } from "next/server";

import { isValidManagedHostingOperatorKey } from "@/features/hosting/server/hosting-operator-auth";

export async function POST(request: Request) {
  const operatorKey = request.headers.get("x-mklms-operator-key");
  if (!isValidManagedHostingOperatorKey(operatorKey)) {
    return NextResponse.json({ ok: false, message: "Operator controls are available only in Mkety production." }, { status: 403 });
  }

  const serviceUrl = process.env.MKLMS_BILLING_SERVICE_URL?.trim();
  if (!serviceUrl) {
    return NextResponse.json({ ok: false, message: "Central billing service is not configured." }, { status: 503 });
  }

  let endpoint: URL;
  try {
    const base = new URL(serviceUrl);
    if (base.protocol !== "https:") throw new Error("Billing service must use HTTPS.");
    endpoint = new URL("v1/operator", base.toString().endsWith("/") ? base : `${base.toString()}/`);
  } catch {
    return NextResponse.json({ ok: false, message: "Central billing service is not configured." }, { status: 503 });
  }

  const body = await request.text();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mkety-operator-key": operatorKey ?? "",
    },
    cache: "no-store",
    body,
  });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { ok: false, message: "Invalid billing-service response." }, { status: response.status });
}
