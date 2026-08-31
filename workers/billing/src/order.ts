const installationPattern = /^[a-z0-9][a-z0-9-]{1,63}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const noncePattern = /^[A-Za-z0-9_-]{8,64}$/;

export function createOrderId(
  installationId: string,
  monthKey: string,
  nonce: string,
): string {
  if (!installationPattern.test(installationId)) {
    throw new Error("Invalid billing installation ID.");
  }
  if (!monthPattern.test(monthKey)) {
    throw new Error("Invalid billing month.");
  }
  if (!noncePattern.test(nonce)) {
    throw new Error("Invalid billing nonce.");
  }
  return `MKBILL.${installationId}.${monthKey}.${nonce}`;
}

export function parseOrderId(orderId: unknown): {
  installationId: string;
  monthKey: string;
  nonce: string;
} | null {
  if (typeof orderId !== "string") return null;
  const match = /^MKBILL\.([a-z0-9][a-z0-9-]{1,63})\.(\d{4}-(?:0[1-9]|1[0-2]))\.([A-Za-z0-9_-]{8,64})$/.exec(orderId);
  if (!match) return null;
  return { installationId: match[1], monthKey: match[2], nonce: match[3] };
}
