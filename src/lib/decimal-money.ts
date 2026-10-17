/** Lossless USD decimal conversions for SQLite integer-cents columns.
 * Refuses fractions of cents, exponent notation, unsafe numeric input and overflow.
 * No database connection, network IO or implicit rounding.
 */
export function usdDecimalToCents(value: string): number {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value))
    throw new Error("USD amount must be a nonnegative decimal with at most two fractional digits");
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("USD amount exceeds safe integer cents");
  return Number(amount);
}
export function centsToUsdDecimal(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Cents must be a nonnegative safe integer");
  const cents = BigInt(value);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
