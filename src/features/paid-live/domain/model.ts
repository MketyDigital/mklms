export type PaidLiveStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PaidLiveState = "UPCOMING" | "LIVE" | "ENDED";
export type PaidLiveDeliveryMode = "MEDIA" | "ZOOM";

export { isAllowedZoomUrl } from "./zoom-url.ts";

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
