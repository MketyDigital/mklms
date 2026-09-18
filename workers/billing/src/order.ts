const installationPattern = /^[a-z0-9][a-z0-9-]{1,63}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const noncePattern = /^[A-Za-z0-9_-]{8,64}$/;
const referencePattern = /^[A-Za-z0-9_-]{8,96}$/;

export function createOrderId(
  installationId: string,
  monthKey: string,
  nonce: string,
  reference?: string,
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
  if (reference !== undefined && !referencePattern.test(reference)) {
    throw new Error("Invalid billing reference.");
  }
  return reference
    ? `MKBILL2.${installationId}.${monthKey}.${nonce}.${reference}`
    : `MKBILL.${installationId}.${monthKey}.${nonce}`;
}

export function parseOrderId(orderId: unknown): {
  installationId: string;
  monthKey: string;
  nonce: string;
  reference: string | null;
} | null {
  if (typeof orderId !== "string") return null;

  const versioned = /^MKBILL2\.([a-z0-9][a-z0-9-]{1,63})\.(\d{4}-(?:0[1-9]|1[0-2]))\.([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{8,96})$/.exec(orderId);
  if (versioned) {
    return {
      installationId: versioned[1],
      monthKey: versioned[2],
      nonce: versioned[3],
      reference: versioned[4],
    };
  }

  const legacy = /^MKBILL\.([a-z0-9][a-z0-9-]{1,63})\.(\d{4}-(?:0[1-9]|1[0-2]))\.([A-Za-z0-9_-]{8,64})$/.exec(orderId);
  if (!legacy) return null;
  return {
    installationId: legacy[1],
    monthKey: legacy[2],
    nonce: legacy[3],
    reference: null,
  };
}
