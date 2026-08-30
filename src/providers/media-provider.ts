export type MediaSourceType =
  | "HLS"
  | "DIRECT"
  | "YOUTUBE"
  | "EXTERNAL_EMBED"
  | "CUSTOM";

export interface MediaAsset {
  id: string;
  sourceType: MediaSourceType | string;
  providerAssetId?: string | null;
  status: string;
}

export interface PlaybackAuthorizationContext {
  studentId?: string | null;
  viewerId?: string | null;
  courseId?: string | null;
  lessonId?: string | null;
  now: Date;
  ttlSeconds: number;
}

export interface PlaybackAuthorization {
  playbackType: "HLS" | "DIRECT" | "EMBED" | "CUSTOM";
  url: string;
  expiresAt: Date | null;
  protection?: "PRIVATE_AUTHORIZATION" | "PUBLIC_SOURCE";
}

export interface MediaProvider {
  createUpload?(input: unknown): Promise<unknown>;
  getAsset?(assetId: string): Promise<MediaAsset | null>;
  createPlaybackAuthorization(
    asset: MediaAsset,
    context: PlaybackAuthorizationContext,
  ): Promise<PlaybackAuthorization>;
  revokeAsset?(assetId: string): Promise<void>;
  deleteAsset?(assetId: string): Promise<void>;
}
