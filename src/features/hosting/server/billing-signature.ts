import { createHmac, timingSafeEqual } from "node:crypto";

function sortObjectDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => sortObjectDeep(item)) as T;
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortObjectDeep((value as Record<string, unknown>)[key]);
    }
    return sorted as T;
  }
  return value;
}

export function canonicalBillingCheckoutPayload(input: {
  installationId: string;
  monthKey: string;
  amountUsd: number;
  timestamp: number;
  nonce: string;
}): string {
  return [
    input.installationId,
    input.monthKey,
    Number(input.amountUsd).toFixed(2),
    String(Math.trunc(input.timestamp)),
    input.nonce,
  ].join("|");
}

export function canonicalBillingSettlementPayload(input: Record<string, unknown>): string {
  return JSON.stringify(sortObjectDeep(input));
}

export function signBillingPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyBillingPayload(
  secret: string,
  payload: string,
  signature: string | null | undefined,
): boolean {
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signBillingPayload(secret, payload), "hex");
  const actual = Buffer.from(signature, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function isFreshBillingTimestamp(timestamp: number, now = new Date(), toleranceSeconds = 300): boolean {
  if (!Number.isInteger(timestamp)) return false;
  return Math.abs(Math.floor(now.getTime() / 1000) - timestamp) <= toleranceSeconds;
}
