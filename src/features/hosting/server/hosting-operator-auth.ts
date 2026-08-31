import { timingSafeEqual } from "node:crypto";

export function isValidManagedHostingOperatorKey(candidate: string | null | undefined): boolean {
  const expected = process.env.MKLMS_MANAGED_HOSTING_OPERATOR_KEY;
  if (!expected || expected.length < 16 || !candidate) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
