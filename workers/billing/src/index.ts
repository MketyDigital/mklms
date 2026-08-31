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

  const settlementSignature = await signHmacHex(
    "sha256",
    customer.sharedSecret,
    canonicalSettlementPayload(settlement),
  );

  const settlementResponse = await runtimeFetch(customer.settlementUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mkety-billing-signature": settlementSignature,
    },
    body: JSON.stringify(settlement),
  });

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
    if (url.pathname === "/webhooks/nowpayments") return handleIpn(request, env, runtimeFetch);
    return json({ ok: false, message: "Not found." }, 404);
  },
};
