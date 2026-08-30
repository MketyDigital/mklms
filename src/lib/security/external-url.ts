export function normalizeSafeExternalUrl(value?: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("External destination must be a safe http or https URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("External destination must be a safe http or https URL.");
  }

  if (!parsed.hostname) {
    throw new Error("External destination must be a safe http or https URL.");
  }

  return parsed.toString();
}
