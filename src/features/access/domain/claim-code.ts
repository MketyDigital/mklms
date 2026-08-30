import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function normalizeClaimCode(code: string): string {
  return code.trim().toUpperCase();
}

export function hashClaimCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalizeClaimCode(code), salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyClaimCode(code: string, stored: string): boolean {
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(normalizeClaimCode(code), salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
