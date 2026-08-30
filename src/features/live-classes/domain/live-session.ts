export type LiveBatchState =
  | "UPCOMING"
  | "LIVE"
  | "BETWEEN_SESSIONS"
  | "ENDED";

export type ViewerDisplayMode =
  | "CONFIGURED_BASELINE"
  | "ACTIVE_ONLY"
  | "BASELINE_PLUS_ACTIVE";

export interface LiveSessionDefinition {
  id: string;
  batchId: string;
  title: string;
  startsAt: Date;
  durationSeconds: number;
  position: number;
  status: string;
}

export interface LiveBatchDefinition {
  id: string;
  slug: string;
  status: string;
  expectedViewerBaseline?: number | null;
  viewerDisplayMode?: ViewerDisplayMode | string | null;
  sessions: LiveSessionDefinition[];
}

export interface ResolvedLiveBatchState {
  state: LiveBatchState;
  isLive: boolean;
  session: LiveSessionDefinition | null;
  countdownTo: Date | null;
  liveOffsetSeconds: number | null;
}

function sessionEnd(session: LiveSessionDefinition): number {
  return session.startsAt.getTime() + Math.max(0, session.durationSeconds) * 1000;
}

export function resolveLiveBatchState(
  batch: LiveBatchDefinition,
  now: Date,
): ResolvedLiveBatchState {
  const published = batch.sessions
    .filter((session) => session.status === "PUBLISHED")
    .sort((a, b) => {
      const time = a.startsAt.getTime() - b.startsAt.getTime();
      return time || a.position - b.position;
    });

  if (!published.length || batch.status !== "ACTIVE") {
    return {
      state: "ENDED",
      isLive: false,
      session: null,
      countdownTo: null,
      liveOffsetSeconds: null,
    };
  }

  const nowMs = now.getTime();

  for (const session of published) {
    const startsAt = session.startsAt.getTime();
    const endsAt = sessionEnd(session);

    if (nowMs >= startsAt && nowMs < endsAt) {
      return {
        state: "LIVE",
        isLive: true,
        session,
        countdownTo: null,
        liveOffsetSeconds: Math.max(0, Math.floor((nowMs - startsAt) / 1000)),
      };
    }
  }

  const nextSession = published.find(
    (session) => session.startsAt.getTime() > nowMs,
  );

  if (nextSession) {
    const first = published[0];
    const state: LiveBatchState =
      nowMs < first.startsAt.getTime() ? "UPCOMING" : "BETWEEN_SESSIONS";

    return {
      state,
      isLive: false,
      session: nextSession,
      countdownTo: nextSession.startsAt,
      liveOffsetSeconds: null,
    };
  }

  return {
    state: "ENDED",
    isLive: false,
    session: null,
    countdownTo: null,
    liveOffsetSeconds: null,
  };
}

function normalizeViewerCount(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}

export function resolveViewerDisplayCount(input: {
  mode: ViewerDisplayMode;
  baseline?: number | null;
  activeViewers?: number | null;
}): number {
  const baseline = normalizeViewerCount(input.baseline);
  const active = normalizeViewerCount(input.activeViewers);

  switch (input.mode) {
    case "ACTIVE_ONLY":
      return active;
    case "BASELINE_PLUS_ACTIVE":
      return baseline + active;
    case "CONFIGURED_BASELINE":
    default:
      return baseline;
  }
}
