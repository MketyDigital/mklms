import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import {
  createAdminSessionValue,
  verifyAdminSessionValue,
} from "../domain/admin-session";

export const ADMIN_SESSION_COOKIE = "mklms_admin_session";

function getAdminAccessKey(): string {
  const value = process.env.MKLMS_ADMIN_ACCESS_KEY;
  if (!value) throw new Error("MKLMS_ADMIN_ACCESS_KEY is required for built-in admin authentication.");
  return value;
}

function getAdminSessionSecret(): string {
  return process.env.MKLMS_ADMIN_SESSION_SECRET ?? getAdminAccessKey();
}

export function verifyAdminAccessKey(candidate: string): boolean {
  const expectedHash = createHash("sha256").update(getAdminAccessKey()).digest();
  const actualHash = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expectedHash, actualHash);
}

export function createBuiltInAdminSession(now = new Date()) {
  const ttlSeconds = Number(process.env.MKLMS_ADMIN_SESSION_TTL_SECONDS ?? 28800);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  return {
    value: createAdminSessionValue(getAdminSessionSecret(), now, ttlSeconds),
    expiresAt,
  };
}

export async function hasValidAdminSession(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!value) return false;
  return verifyAdminSessionValue(value, getAdminSessionSecret(), new Date());
}

export function getAdminCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
