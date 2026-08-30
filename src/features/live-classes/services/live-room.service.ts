import {
  resolveViewerDisplayCount,
  type ViewerDisplayMode,
} from "../domain/live-session.ts";
import {
  getInitialTimelineMessages,
  type LiveTimelineMessage,
} from "../domain/live-timeline.ts";

export interface LiveAttendeeMessageRecord {
  id: string;
  displayName?: string | null;
  message: string;
  createdAt: Date;
}

export interface LiveRoomRepository {
  upsertViewerHeartbeat(input: {
    batchId: string;
    sessionId?: string | null;
    viewerTokenHash: string;
    displayName?: string | null;
  }): Promise<{ id: string }>;
  countActiveViewers(input: {
    batchId: string;
    sessionId?: string | null;
    activeSince: Date;
  }): Promise<number>;
  listViewerMessages(viewerId: string): Promise<LiveAttendeeMessageRecord[]>;
  listAdminAttendeeMessages(input: {
    batchId: string;
    sessionId?: string | null;
  }): Promise<LiveAttendeeMessageRecord[]>;
}

export class LiveRoomService {
  private readonly repository: LiveRoomRepository;
  private readonly activeWindowMs: number;

  constructor(repository: LiveRoomRepository, options?: { activeWindowMs?: number }) {
    this.repository = repository;
    this.activeWindowMs = Math.max(15_000, options?.activeWindowMs ?? 120_000);
  }

  async heartbeat(input: {
    batchId: string;
    sessionId?: string | null;
    viewerTokenHash: string;
    displayName?: string | null;
    viewerDisplayMode: ViewerDisplayMode;
    expectedViewerBaseline?: number | null;
    now?: Date;
  }): Promise<{
    viewerId: string;
    activeViewers: number;
    displayViewerCount: number;
  }> {
    const now = input.now ?? new Date();
    const viewer = await this.repository.upsertViewerHeartbeat({
      batchId: input.batchId,
      sessionId: input.sessionId ?? null,
      viewerTokenHash: input.viewerTokenHash,
      displayName: input.displayName ?? null,
    });
    const activeViewers = await this.repository.countActiveViewers({
      batchId: input.batchId,
      sessionId: input.sessionId ?? null,
      activeSince: new Date(now.getTime() - this.activeWindowMs),
    });

    return {
      viewerId: viewer.id,
      activeViewers,
      displayViewerCount: resolveViewerDisplayCount({
        mode: input.viewerDisplayMode,
        baseline: input.expectedViewerBaseline,
        activeViewers,
      }),
    };
  }

  async getPublicChat(input: {
    viewerId: string;
    liveOffsetSeconds: number;
    stagedMessages: readonly LiveTimelineMessage[];
    recentStagedLimit?: number;
  }): Promise<{
    staged: LiveTimelineMessage[];
    own: LiveAttendeeMessageRecord[];
  }> {
    const [own, staged] = await Promise.all([
      this.repository.listViewerMessages(input.viewerId),
      Promise.resolve(
        getInitialTimelineMessages(
          input.stagedMessages,
          input.liveOffsetSeconds,
          input.recentStagedLimit ?? 20,
        ),
      ),
    ]);

    return { staged, own };
  }

  async getAdminAttendeeMessages(input: {
    batchId: string;
    sessionId?: string | null;
  }): Promise<LiveAttendeeMessageRecord[]> {
    return this.repository.listAdminAttendeeMessages(input);
  }
}
