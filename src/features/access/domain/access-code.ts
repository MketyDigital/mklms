import {
  createHash,
  randomBytes as cryptoRandomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import type { AccessCodeHash } from "../types";

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

export function generateAccessCode(options?: {
  prefix?: string;
  randomBytes?: number;
}): string {
  const prefix = (options?.prefix ?? "ACCESS").trim().toUpperCase();
  const byteLength = Math.max(8, options?.randomBytes ?? 12);
  const bytes = cryptoRandomBytes(byteLength);

  let token = "";
  for (const byte of bytes) {
    token += ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length];
  }

  return `${prefix}-${token}`;
}

export function getAccessCodeLookupHash(code: string): string {
  return createHash("sha256").update(normalizeAccessCode(code)).digest("hex");
}

export function hashAccessCode(code: string): AccessCodeHash {
  const normalized = normalizeAccessCode(code);
  const salt = cryptoRandomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, 32).toString("hex");

  return {
    algorithm: "scrypt",
    salt,
    hash,
  };
}

export function verifyAccessCode(code: string, stored: AccessCodeHash): boolean {
  if (stored.algorithm !== "scrypt") return false;

  const expected = Buffer.from(stored.hash, "hex");
  const actual = scryptSync(normalizeAccessCode(code), stored.salt, expected.length);

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
