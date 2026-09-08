export const DEFAULT_PORTAL_FONT_FAMILY = "Geist";

const SYSTEM_FONT_FAMILIES = new Set([
  "system-ui",
  "ui-sans-serif",
  "sans-serif",
  "serif",
  "monospace",
]);

const SAFE_GOOGLE_FONT_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/;

export function normalizePortalFontFamily(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) return null;
  if (SYSTEM_FONT_FAMILIES.has(normalized)) return normalized;
  return SAFE_GOOGLE_FONT_FAMILY.test(normalized) ? normalized : null;
}

export function googleFontStylesheetUrl(value: string | null | undefined): string | null {
  const family = normalizePortalFontFamily(value);
  if (!family || family === DEFAULT_PORTAL_FONT_FAMILY || SYSTEM_FONT_FAMILIES.has(family)) return null;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
}

export function portalFontStack(value: string | null | undefined): string {
  const family = normalizePortalFontFamily(value) ?? DEFAULT_PORTAL_FONT_FAMILY;
  if (family === DEFAULT_PORTAL_FONT_FAMILY) return "var(--font-geist-sans), Arial, sans-serif";
  if (SYSTEM_FONT_FAMILIES.has(family)) return `${family}, Arial, sans-serif`;
  return `\"${family}\", var(--font-geist-sans), Arial, sans-serif`;
}
