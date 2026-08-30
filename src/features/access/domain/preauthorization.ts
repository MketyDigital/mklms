import type {
  ClaimIdentityInput,
  PreauthorizationRecord,
} from "../types";

export type IdentityKind = "email" | "phone";

export function normalizeIdentity(value: string, kind: IdentityKind): string {
  const trimmed = value.trim();
  if (kind === "email") return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, "");
}

export function findMatchingPreauthorization(
  records: PreauthorizationRecord[],
  identity: ClaimIdentityInput,
): PreauthorizationRecord | null {
  const email = identity.email
    ? normalizeIdentity(identity.email, "email")
    : null;
  const phone = identity.phone
    ? normalizeIdentity(identity.phone, "phone")
    : null;

  for (const record of records) {
    if (record.status !== "PREAUTHORIZED") continue;

    const recordEmail = record.email
      ? normalizeIdentity(record.email, "email")
      : null;
    const recordPhone = record.phone
      ? normalizeIdentity(record.phone, "phone")
      : null;

    if (email && recordEmail === email) return record;
    if (phone && recordPhone === phone) return record;
  }

  return null;
}
