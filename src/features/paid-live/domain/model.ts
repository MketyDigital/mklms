export type PaidLiveStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PaidLiveState = "UPCOMING" | "LIVE" | "ENDED";

export interface PaidCourseLiveSession {
  id: string;
  courseId: string;
  mediaAssetId?: string | null;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  status: PaidLiveStatus;
}
