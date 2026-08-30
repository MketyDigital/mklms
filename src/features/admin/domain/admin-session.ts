import { createHmac, timingSafeEqual } from "node:crypto";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSessionValue(
  secret: string,
  now = new Date(),
  ttlSeconds = 28800,
): string {
  const expiresAt = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSessionValue(
  value: string,
  secret: string,
  now = new Date(),
): boolean {
  const [expiresRaw, signature] = value.split(".");
  if (!expiresRaw || !signature || !/^\d+$/.test(expiresRaw)) return false;

  const expected = Buffer.from(sign(expiresRaw, secret), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return false;
  }

  const expiresAt = Number(expiresRaw);
  return expiresAt > Math.floor(now.getTime() / 1000);
}
