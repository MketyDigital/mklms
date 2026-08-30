import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface StoredSessionTokenHash {
  hash: string;
}

export function createSessionToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashSessionToken(token: string): StoredSessionTokenHash {
  return {
    hash: createHash("sha256").update(token).digest("hex"),
  };
}

export function verifySessionToken(
  token: string,
  stored: StoredSessionTokenHash,
): boolean {
  const candidate = Buffer.from(
    createHash("sha256").update(token).digest("hex"),
    "utf8",
  );
  const expected = Buffer.from(stored.hash, "utf8");

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function isSessionExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
