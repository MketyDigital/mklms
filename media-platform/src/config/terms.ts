export const BILLING_TERMS = [
  { months: 1, discountPercent: 0, label: "Monthly" },
  { months: 3, discountPercent: 3, label: "3 months" },
  { months: 6, discountPercent: 5, label: "6 months" },
  { months: 12, discountPercent: 8, label: "12 months" },
] as const;

export function termPrice(monthlyUsd: number, months: number) {
  const term = BILLING_TERMS.find((item) => item.months === months);
  if (!term) throw new Error("Unsupported billing term");
  const gross = monthlyUsd * months;
  const total = gross * (1 - term.discountPercent / 100);
  return Math.round(total * 100) / 100;
}
