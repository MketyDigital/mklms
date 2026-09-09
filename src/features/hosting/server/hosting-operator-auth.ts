import { timingSafeEqual } from "node:crypto";

const MKETY_OPERATOR_INSTALLATION_ID = "mkety-academy";

/**
 * Billing/pricing mutation authority belongs only to the trusted Mkety
 * production installation. Customer installations can display their own
 * Hosting & Usage state but cannot unlock operator pricing controls even if a
 * browser discovers the operator endpoints.
 */
export function isTrustedMketyBillingOperatorContext(): boolean {
  return process.env.MKLMS_BILLING_INSTALLATION_ID?.trim() === MKETY_OPERATOR_INSTALLATION_ID;
}

export function isValidManagedHostingOperatorKey(candidate: string | null | undefined): boolean {
  if (!isTrustedMketyBillingOperatorContext()) return false;
  const expected = process.env.MKLMS_MANAGED_HOSTING_OPERATOR_KEY;
  if (!expected || expected.length < 16 || !candidate) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
