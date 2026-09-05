export type PaidLiveStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PaidLiveState = "UPCOMING" | "LIVE" | "ENDED";
export type PaidLiveDeliveryMode = "MEDIA" | "ZOOM";

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

export interface PaidCourseLiveSession {
  id: string;
  courseId: string;
  mediaAssetId?: string | null;
  zoomUrl?: string | null;
  deliveryMode: PaidLiveDeliveryMode;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  status: PaidLiveStatus;
}
