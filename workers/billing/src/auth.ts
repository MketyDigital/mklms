const encoder = new TextEncoder();

function algorithmName(algorithm: "sha256" | "sha512") {
  return algorithm === "sha512" ? "SHA-512" : "SHA-256";
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function signHmacHex(
  algorithm: "sha256" | "sha512",
  secret: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithmName(algorithm) },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

export async function verifyHmacHex(
  algorithm: "sha256" | "sha512",
  secret: string,
  payload: string,
  signature: string | null | undefined,
): Promise<boolean> {
  if (!secret || !signature || !/^[a-f0-9]+$/i.test(signature)) return false;
  const expected = await signHmacHex(algorithm, secret, payload);
  return constantTimeEqual(expected.toLowerCase(), signature.toLowerCase());
}

export function sortObjectDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortObjectDeep((value as Record<string, unknown>)[key]);
    }
    return sorted as T;
  }
  return value;
}

export interface CheckoutSignatureInput {
  installationId: string;
  monthKey: string;
  amountUsd: number;
  timestamp: number;
  nonce: string;
}

export function canonicalCheckoutPayload(input: CheckoutSignatureInput): string {
  return [
    input.installationId,
    input.monthKey,
    Number(input.amountUsd).toFixed(2),
    String(Math.trunc(input.timestamp)),
    input.nonce,
  ].join("|");
}

export function canonicalSettlementPayload(input: Record<string, unknown>): string {
  return JSON.stringify(sortObjectDeep(input));
}
