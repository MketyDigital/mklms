import {
  resolveViewerDisplayCount,
  type ViewerDisplayMode,
} from "../domain/live-session.ts";
import {
  getInitialTimelineMessages,
  type LiveTimelineMessage,
} from "../domain/live-timeline.ts";

export type AttendeeChatVisibility = "OWNER_ONLY" | "PUBLIC";

export interface LiveAttendeeMessageRecord {
  id: string;
  sessionId?: string | null;
  displayName?: string | null;
  message: string;
  createdAt: Date;
}

export interface LiveRoomRepository {
  findViewerByTokenHash(
    batchId: string,
    viewerTokenHash: string,
  ): Promise<{ id: string; displayName?: string | null } | null>;
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
  listViewerMessages(viewerId: string, sessionId: string): Promise<LiveAttendeeMessageRecord[]>;
  listSessionAttendeeMessages?(sessionId: string): Promise<LiveAttendeeMessageRecord[]>;
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
    const needsMeasuredPresence = input.viewerDisplayMode !== "CONFIGURED_BASELINE";

    let viewer: { id: string };
    if (needsMeasuredPresence) {
      viewer = await this.repository.upsertViewerHeartbeat({
        batchId: input.batchId,
        sessionId: input.sessionId ?? null,
        viewerTokenHash: input.viewerTokenHash,
        displayName: input.displayName ?? null,
      });
    } else {
      const existingViewer = await this.repository.findViewerByTokenHash(
        input.batchId,
        input.viewerTokenHash,
      );
      viewer = existingViewer ?? await this.repository.upsertViewerHeartbeat({
        batchId: input.batchId,
        sessionId: input.sessionId ?? null,
        viewerTokenHash: input.viewerTokenHash,
        displayName: input.displayName ?? null,
      });
    }

    const activeViewers = needsMeasuredPresence
      ? await this.repository.countActiveViewers({
          batchId: input.batchId,
          sessionId: input.sessionId ?? null,
          activeSince: new Date(now.getTime() - this.activeWindowMs),
        })
      : 0;

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
    sessionId: string;
    liveOffsetSeconds: number;
    stagedMessages: readonly LiveTimelineMessage[];
    recentStagedLimit?: number;
    attendeeChatVisibility?: AttendeeChatVisibility;
  }): Promise<
    | { staged: LiveTimelineMessage[]; own: LiveAttendeeMessageRecord[] }
    | { staged: LiveTimelineMessage[]; own: LiveAttendeeMessageRecord[]; shared: LiveAttendeeMessageRecord[] }
  > {
    const [own, staged] = await Promise.all([
      this.repository.listViewerMessages(input.viewerId, input.sessionId),
      Promise.resolve(
        getInitialTimelineMessages(
          input.stagedMessages,
          input.liveOffsetSeconds,
          input.recentStagedLimit ?? 20,
        ),
      ),
    ]);

    if (input.attendeeChatVisibility !== "PUBLIC") {
      return { staged, own };
    }

    const allSessionMessages = await this.repository.listSessionAttendeeMessages?.(input.sessionId) ?? [];
    const ownIds = new Set(own.map((message) => message.id));
    const shared = allSessionMessages.filter((message) => !ownIds.has(message.id));
    return { staged, own, shared };
  }

  async getAdminAttendeeMessages(input: {
    batchId: string;
    sessionId?: string | null;
  }): Promise<LiveAttendeeMessageRecord[]> {
    return this.repository.listAdminAttendeeMessages(input);
  }
}
