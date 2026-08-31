export type ParsedByteRange =
  | { ok: true; start: number; end: number; length: number }
  | { ok: false };

export function parseByteRange(
  header: string | null,
  size: number,
): ParsedByteRange | null {
  if (header === null) return null;
  if (!Number.isSafeInteger(size) || size <= 0) return { ok: false };
  if (!header.startsWith("bytes=")) return { ok: false };

  const value = header.slice("bytes=".length).trim();
  if (!value || value.includes(",")) return { ok: false };

  const match = /^(\d*)-(\d*)$/.exec(value);
  if (!match) return { ok: false };

  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) return { ok: false };

  if (!startRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { ok: false };
    }
    const length = Math.min(suffixLength, size);
    const start = size - length;
    const end = size - 1;
    return { ok: true, start, end, length };
  }

  const start = Number(startRaw);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) {
    return { ok: false };
  }

  if (!endRaw) {
    const end = size - 1;
    return { ok: true, start, end, length: end - start + 1 };
  }

  const requestedEnd = Number(endRaw);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
    return { ok: false };
  }

  const end = Math.min(requestedEnd, size - 1);
  return { ok: true, start, end, length: end - start + 1 };
}
