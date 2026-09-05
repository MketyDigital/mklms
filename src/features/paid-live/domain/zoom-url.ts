export function isAllowedZoomUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return hostname === "zoom.us" || hostname.endsWith(".zoom.us");
  } catch {
    return false;
  }
}
