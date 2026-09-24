const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createApprovalToken(input: {
  invoiceId: string;
  action: "approve" | "reject";
  operatorId: string;
  expiresAt: number;
  nonce: string;
  secret: string;
}) {
  const payload = [
    input.invoiceId,
    input.action,
    input.operatorId,
    input.expiresAt,
    input.nonce,
  ].join("|");
  const signature = await hmac(input.secret, payload);
  return btoa(JSON.stringify({
    invoiceId: input.invoiceId,
    action: input.action,
    operatorId: input.operatorId,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
    signature,
  }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// Verification must additionally enforce:
// - token expiration;
// - one-time nonce consumption in the database;
// - operator allow-list / authenticated operator identity;
// - invoice still pending;
// - amount/reference unchanged;
// - audit log write in the same transaction as settlement.
