/** Exact conversion helpers for PostgreSQL NUMERIC(12,2) USD and D1 INTEGER cents. */
export function encodeUsdAsCents(value) {
  const text = value;
  if (typeof text !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) {
    throw new TypeError('USD amount must be a decimal string with at most two fractional digits');
  }
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  const signed = negative ? -cents : cents;
  const asNumber = Number(signed);
  if (!Number.isSafeInteger(asNumber)) throw new TypeError('USD amount exceeds safe integer cents range');
  return asNumber;
}

export function decodeCentsAsUsd(value) {
  if (!Number.isSafeInteger(value)) throw new TypeError('Value must be safe integer cents');
  const sign = value < 0 ? '-' : '';
  const absolute = BigInt(Math.abs(value));
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
