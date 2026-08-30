import type {
  MediaAsset,
  MediaProvider,
  PlaybackAuthorization,
} from "@/providers/media-provider";
import {
  resolveLiveBatchState,
  type LiveBatchDefinition,
} from "../domain/live-session.ts";

export interface LivePlaybackRepository {
  getMediaAsset(id: string): Promise<MediaAsset | null>;
}

export type LivePlaybackResult =
  | {
      ok: true;
      state: "LIVE";
      sessionId: string;
      startAtSeconds: number;
      authorization: PlaybackAuthorization;
    }
  | {
      ok: false;
      state: "UPCOMING" | "BETWEEN_SESSIONS" | "ENDED" | "LIVE";
      reason: "NOT_LIVE" | "MEDIA_UNAVAILABLE";
      sessionId?: string | null;
      startAtSeconds?: number | null;
      authorization?: undefined;
    };

export class LivePlaybackService {
  private readonly repository: LivePlaybackRepository;
  private readonly mediaProvider: MediaProvider;
  private readonly ttlSeconds: number;

  constructor(
    repository: LivePlaybackRepository,
    mediaProvider: MediaProvider,
    options?: { ttlSeconds?: number },
  ) {
    this.repository = repository;
    this.mediaProvider = mediaProvider;
    this.ttlSeconds = Math.max(30, Math.min(900, options?.ttlSeconds ?? 180));
  }

  async authorize(input: {
    batch: LiveBatchDefinition & {
      sessions: Array<
        LiveBatchDefinition["sessions"][number] & { mediaAssetId?: string | null }
      >;
    };
    viewerId: string;
    now?: Date;
  }): Promise<LivePlaybackResult> {
    const now = input.now ?? new Date();
    const state = resolveLiveBatchState(input.batch, now);

    if (!state.isLive || state.state !== "LIVE" || !state.session) {
      return {
        ok: false,
        state: state.state,
        reason: "NOT_LIVE",
        sessionId: state.session?.id ?? null,
        startAtSeconds: null,
      };
    }

    const liveSession = input.batch.sessions.find(
      (session) => session.id === state.session?.id,
    );
    if (!liveSession?.mediaAssetId) {
      return {
        ok: false,
        state: "LIVE",
        reason: "MEDIA_UNAVAILABLE",
        sessionId: state.session.id,
        startAtSeconds: state.liveOffsetSeconds ?? 0,
      };
    }

    const asset = await this.repository.getMediaAsset(liveSession.mediaAssetId);
    if (!asset || asset.status !== "READY") {
      return {
        ok: false,
        state: "LIVE",
        reason: "MEDIA_UNAVAILABLE",
        sessionId: state.session.id,
        startAtSeconds: state.liveOffsetSeconds ?? 0,
      };
    }

    const authorization = await this.mediaProvider.createPlaybackAuthorization(asset, {
      viewerId: input.viewerId,
      studentId: null,
      courseId: null,
      lessonId: null,
      now,
      ttlSeconds: this.ttlSeconds,
    });

    return {
      ok: true,
      state: "LIVE",
      sessionId: state.session.id,
      startAtSeconds: state.liveOffsetSeconds ?? 0,
      authorization,
    };
  }
}
