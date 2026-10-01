import {
  canonicalCheckoutPayload,
  canonicalSettlementPayload,
  signHmacHex,
  sortObjectDeep,
  verifyHmacHex,
} from "./auth.ts";
import { createOrderId, parseOrderId } from "./order.ts";

interface CustomerConfig {
  settlementUrl: string;
  sharedSecret: string;
  successUrl: string;
  cancelUrl: string;
}

interface Env {
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;
  MKETY_BILLING_CUSTOMERS_JSON?: string;
  MKETY_MANAGED_HOSTING_OPERATOR_KEY?: string;
}

interface TestContext {
  fetch?: typeof fetch;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function parseCustomers(env: Env): Record<string, CustomerConfig> {
  if (!env.MKETY_BILLING_CUSTOMERS_JSON) {
    throw new Error("MKETY_BILLING_CUSTOMERS_JSON is required.");
  }
  const parsed = JSON.parse(env.MKETY_BILLING_CUSTOMERS_JSON) as Record<string, Partial<CustomerConfig>>;
  const output: Record<string, CustomerConfig> = {};
  for (const [id, value] of Object.entries(parsed)) {
    if (
      typeof value?.settlementUrl !== "string" ||
      typeof value?.sharedSecret !== "string" ||
      value.sharedSecret.length < 16 ||
      typeof value?.successUrl !== "string" ||
      typeof value?.cancelUrl !== "string"
    ) {
      continue;
    }
    const settlement = new URL(value.settlementUrl);
    const success = new URL(value.successUrl);
    const cancel = new URL(value.cancelUrl);
    if (settlement.protocol !== "https:" || success.protocol !== "https:" || cancel.protocol !== "https:") {
      continue;
    }
    output[id] = {
      settlementUrl: settlement.toString(),
      sharedSecret: value.sharedSecret,
      successUrl: success.toString(),
      cancelUrl: cancel.toString(),
    };
  }
  return output;
}

function validMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function constantTimeTextEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function isValidOperatorKey(request: Request, env: Env): boolean {
  const expected = env.MKETY_MANAGED_HOSTING_OPERATOR_KEY?.trim() ?? "";
  const candidate = request.headers.get("x-mkety-operator-key")?.trim() ?? "";
  return expected.length >= 16 && candidate.length >= 16 && constantTimeTextEqual(expected, candidate);
}

function customerControlUrl(customer: CustomerConfig): string {
  return new URL("/api/managed-hosting/operator", customer.settlementUrl).toString();
}

async function handleInvoice(request: Request, env: Env, runtimeFetch: typeof fetch): Promise<Response> {
  if (!env.NOWPAYMENTS_API_KEY) return json({ ok: false, message: "Billing provider is not configured." }, 503);

  let customers: Record<string, CustomerConfig>;
  try {
    customers = parseCustomers(env);
  } catch {
    return json({ ok: false, message: "Billing customer registry is not configured." }, 503);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, message: "Invalid request." }, 400);

  const installationId = typeof body.installationId === "string" ? body.installationId : "";
  const monthKey = body.monthKey;
  const amountUsd = Number(body.amountUsd);
  const timestamp = Number(body.timestamp);
  const nonce = typeof body.nonce === "string" ? body.nonce : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  const customer = customers[installationId];

  if (
    !customer ||
    !validMonthKey(monthKey) ||
    !Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 100000 ||
    !Number.isInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300 ||
    !/^[A-Za-z0-9_-]{8,64}$/.test(nonce)
  ) {
    return json({ ok: false, message: "Invalid billing request." }, 400);
  }

  const canonical = canonicalCheckoutPayload({ installationId, monthKey, amountUsd, timestamp, nonce });
  if (!(await verifyHmacHex("sha256", customer.sharedSecret, canonical, signature))) {
    return json({ ok: false, message: "Unauthorized billing request." }, 401);
  }

  let orderId: string;
  try {
    orderId = createOrderId(installationId, monthKey, nonce);
  } catch {
    return json({ ok: false, message: "Invalid billing request." }, 400);
  }

  const origin = new URL(request.url).origin;
  const providerResponse = await runtimeFetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.NOWPAYMENTS_API_KEY,
    },
    body: JSON.stringify({
      price_amount: Math.round(amountUsd * 100) / 100,
      price_currency: "usd",
      order_id: orderId,
      order_description: `Managed hosting ${installationId} ${monthKey}`,
      ipn_callback_url: `${origin}/webhooks/nowpayments`,
      success_url: customer.successUrl,
      cancel_url: customer.cancelUrl,
    }),
  });

  const providerPayload = (await providerResponse.json().catch(() => null)) as { invoice_url?: string } | null;
  if (!providerResponse.ok || !providerPayload?.invoice_url) {
    return json({ ok: false, message: "Payment invoice could not be created." }, 502);
  }

  return json({ ok: true, invoiceUrl: providerPayload.invoice_url, orderId });
}

async function deliverSettlement(
  customer: CustomerConfig,
  settlement: Record<string, unknown>,
  runtimeFetch: typeof fetch,
): Promise<Response> {
  const settlementSignature = await signHmacHex(
    "sha256",
    customer.sharedSecret,
    canonicalSettlementPayload(settlement),
  );
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await runtimeFetch(customer.settlementUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mkety-billing-signature": settlementSignature,
      },
      body: JSON.stringify(settlement),
    });
    if (response.ok) return response;
  }
  return response ?? new Response(null, { status: 502 });
}

async function handleReconcile(request: Request, env: Env, runtimeFetch: typeof fetch): Promise<Response> {
  if (!env.NOWPAYMENTS_API_KEY) return json({ ok: false, message: "Billing provider is not configured." }, 503);

  let customers: Record<string, CustomerConfig>;
  try {
    customers = parseCustomers(env);
  } catch {
    return json({ ok: false, message: "Billing customer registry is not configured." }, 503);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, message: "Invalid reconciliation request." }, 400);

  const installationId = typeof body.installationId === "string" ? body.installationId : "";
  const monthKey = body.monthKey;
  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const timestamp = Number(body.timestamp);
  const nonce = typeof body.nonce === "string" ? body.nonce : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  const customer = customers[installationId];

  if (
    !customer ||
    !validMonthKey(monthKey) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(paymentId) ||
    !Number.isInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300 ||
    !/^[A-Za-z0-9_-]{8,64}$/.test(nonce)
  ) {
    return json({ ok: false, message: "Invalid reconciliation request." }, 400);
  }

  const canonical = JSON.stringify(sortObjectDeep({ installationId, monthKey, paymentId, timestamp, nonce }));
  if (!(await verifyHmacHex("sha256", customer.sharedSecret, canonical, signature))) {
    return json({ ok: false, message: "Unauthorized reconciliation request." }, 401);
  }

  const providerResponse = await runtimeFetch(`https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: { "x-api-key": env.NOWPAYMENTS_API_KEY },
  });
  const provider = (await providerResponse.json().catch(() => null)) as Record<string, unknown> | null;
  if (!providerResponse.ok || !provider) {
    return json({ ok: false, message: "Could not verify payment with NOWPayments." }, 502);
  }

  const order = parseOrderId(provider.order_id);
  if (!order || order.installationId !== installationId || order.monthKey !== monthKey) {
    return json({ ok: false, message: "Payment does not belong to this billing month." }, 409);
  }
  if (String(provider.payment_status ?? "") !== "finished") {
    return json({ ok: false, message: `NOWPayments status is ${String(provider.payment_status ?? "unknown")}, not finished.` }, 409);
  }

  const settlement = {
    installationId,
    monthKey,
    paymentId: String(provider.payment_id ?? paymentId),
    paymentStatus: "finished",
    priceAmount: Number(provider.price_amount ?? 0),
    priceCurrency: String(provider.price_currency ?? "usd"),
    actuallyPaid: Number(provider.actually_paid ?? provider.pay_amount ?? 0),
    payCurrency: String(provider.pay_currency ?? ""),
    timestamp: Math.floor(Date.now() / 1000),
  };
  if (!Number.isFinite(settlement.priceAmount) || settlement.priceAmount <= 0) {
    return json({ ok: false, message: "NOWPayments returned an invalid finished payment." }, 409);
  }

  const settlementResponse = await deliverSettlement(customer, settlement, runtimeFetch);
  if (!settlementResponse.ok) {
    return json({ ok: false, message: "Verified payment could not be applied to the installation." }, 502);
  }
  return json({ ok: true, reconciled: true, status: "finished" });
}

async function handleOperator(request: Request, env: Env, runtimeFetch: typeof fetch): Promise<Response> {
  if (!isValidOperatorKey(request, env)) {
    return json({ ok: false, message: "Invalid operator key." }, 403);
  }

  let customers: Record<string, CustomerConfig>;
  try {
    customers = parseCustomers(env);
  } catch {
    return json({ ok: false, message: "Billing customer registry is not configured." }, 503);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, message: "Invalid operator request." }, 400);

  const installationId = typeof body.installationId === "string" ? body.installationId : "";
  const action = typeof body.action === "string" ? body.action : "";
  const customer = customers[installationId];
  if (!customer) return json({ ok: false, message: "Unknown billing installation." }, 404);

  if (action === "reconcilePayment") {
    if (!env.NOWPAYMENTS_API_KEY) return json({ ok: false, message: "Billing provider is not configured." }, 503);
    const monthKey = body.monthKey;
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
    if (!validMonthKey(monthKey) || !/^[A-Za-z0-9_-]{1,128}$/.test(paymentId)) {
      return json({ ok: false, message: "A valid month and NOWPayments payment ID are required." }, 400);
    }

    const providerResponse = await runtimeFetch(`https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: { "x-api-key": env.NOWPAYMENTS_API_KEY },
    });
    const provider = (await providerResponse.json().catch(() => null)) as Record<string, unknown> | null;
    if (!providerResponse.ok || !provider) {
      return json({ ok: false, message: "Could not verify payment with NOWPayments." }, 502);
    }

    const order = parseOrderId(provider.order_id);
    if (!order || order.installationId !== installationId || order.monthKey !== monthKey) {
      return json({ ok: false, message: "Payment does not belong to this installation and billing month." }, 409);
    }
    if (String(provider.payment_status ?? "") !== "finished") {
      return json({ ok: false, message: `NOWPayments status is ${String(provider.payment_status ?? "unknown")}, not finished.` }, 409);
    }

    const settlement = {
      installationId,
      monthKey,
      paymentId: String(provider.payment_id ?? paymentId),
      paymentStatus: "finished",
      priceAmount: Number(provider.price_amount ?? 0),
      priceCurrency: String(provider.price_currency ?? "usd"),
      actuallyPaid: Number(provider.actually_paid ?? provider.pay_amount ?? 0),
      payCurrency: String(provider.pay_currency ?? ""),
      timestamp: Math.floor(Date.now() / 1000),
    };
    if (!Number.isFinite(settlement.priceAmount) || settlement.priceAmount <= 0) {
      return json({ ok: false, message: "NOWPayments returned an invalid finished payment." }, 409);
    }

    const settlementResponse = await deliverSettlement(customer, settlement, runtimeFetch);
    if (!settlementResponse.ok) {
      return json({ ok: false, message: "Verified payment could not be applied to the installation." }, 502);
    }
    return json({ ok: true, reconciled: true, status: "finished" });
  }

  const allowedActions = new Set([
    "getPolicy",
    "setPolicy",
    "getMonth",
    "setMonth",
    "getAdjustments",
    "addAdjustment",
  ]);
  if (!allowedActions.has(action)) {
    return json({ ok: false, message: "Unknown operator action." }, 400);
  }

  const command = {
    ...body,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const signature = await signHmacHex(
    "sha256",
    customer.sharedSecret,
    canonicalSettlementPayload(command),
  );
  const response = await runtimeFetch(customerControlUrl(customer), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mkety-billing-signature": signature,
    },
    body: JSON.stringify(command),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return json(
      { ok: false, message: (payload as { message?: string } | null)?.message ?? "Customer billing command failed." },
      response.status,
    );
  }
  return json({ ok: true, installationId, result: payload });
}

async function handleIpn(request: Request, env: Env, runtimeFetch: typeof fetch): Promise<Response> {
  if (!env.NOWPAYMENTS_IPN_SECRET) {
    return json({ ok: false, message: "IPN verification is not configured." }, 503);
  }
  const signature = request.headers.get("x-nowpayments-sig");
  if (!signature) return json({ ok: false, message: "Unauthorized." }, 401);

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return json({ ok: false, message: "Invalid callback." }, 400);

  const canonicalIpn = JSON.stringify(sortObjectDeep(payload));
  if (!(await verifyHmacHex("sha512", env.NOWPAYMENTS_IPN_SECRET, canonicalIpn, signature))) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  let customers: Record<string, CustomerConfig>;
  try {
    customers = parseCustomers(env);
  } catch {
    return json({ ok: false, message: "Billing customer registry is not configured." }, 503);
  }

  const order = parseOrderId(payload.order_id);
  if (!order) return json({ ok: false, message: "Unknown billing order." }, 400);
  const customer = customers[order.installationId];
  if (!customer) return json({ ok: false, message: "Unknown billing installation." }, 404);

  const paymentStatus = typeof payload.payment_status === "string" ? payload.payment_status : "";
  if (paymentStatus !== "finished") {
    return json({ ok: true, settled: false, status: paymentStatus || "unknown" });
  }

  const settlement = {
    installationId: order.installationId,
    monthKey: order.monthKey,
    paymentId: String(payload.payment_id ?? ""),
    paymentStatus,
    priceAmount: Number(payload.price_amount ?? 0),
    priceCurrency: String(payload.price_currency ?? "usd"),
    actuallyPaid: Number(payload.actually_paid ?? payload.pay_amount ?? 0),
    payCurrency: String(payload.pay_currency ?? ""),
    timestamp: Math.floor(Date.now() / 1000),
  };
  if (!settlement.paymentId || !Number.isFinite(settlement.priceAmount) || settlement.priceAmount <= 0) {
    return json({ ok: false, message: "Invalid finished payment." }, 400);
  }

  const settlementResponse = await deliverSettlement(customer, settlement, runtimeFetch);

  if (!settlementResponse.ok) {
    return json({ ok: false, message: "Customer settlement failed." }, 502);
  }

  return json({ ok: true, settled: true });
}

export default {
  async fetch(request: Request, env: Env, context?: TestContext): Promise<Response> {
    const runtimeFetch = context?.fetch ?? fetch;
    const url = new URL(request.url);
    if (request.method !== "POST") return json({ ok: false, message: "Method not allowed." }, 405);
    if (url.pathname === "/v1/invoices") return handleInvoice(request, env, runtimeFetch);
    if (url.pathname === "/v1/reconcile") return handleReconcile(request, env, runtimeFetch);
    if (url.pathname === "/v1/operator") return handleOperator(request, env, runtimeFetch);
    if (url.pathname === "/webhooks/nowpayments") return handleIpn(request, env, runtimeFetch);
    return json({ ok: false, message: "Not found." }, 404);
  },
};
