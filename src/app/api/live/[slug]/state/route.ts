import { NextResponse } from "next/server";

import { LIVE_STATE_CACHE_CONTROL } from "@/features/live-classes/domain/live-client-cache";
import { resolveLiveBatchState, resolveViewerDisplayCount } from "@/features/live-classes/domain/live-session";
import { PostgresLiveClassRepository } from "@/features/live-classes/repositories/postgres-live-class.repository";
import { getOrCreateLiveViewerIdentity } from "@/features/live-classes/server/live-viewer";
import { LiveRoomService } from "@/features/live-classes/services/live-room.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const repository = new PostgresLiveClassRepository();
  const batch = await repository.findPublicBatchBySlug(slug);
  if (!batch) {
    return NextResponse.json(
      { ok: false, message: "This live class is not available." },
      { status: 404, headers: { "Cache-Control": "public, max-age=0, s-maxage=15" } },
    );
  }

  const now = new Date();
  const state = resolveLiveBatchState(batch, now);
  const session = state.session
    ? batch.sessions.find((item) => item.id === state.session?.id) ?? null
    : null;
  const stagedMessages = session
    ? await repository.listTimelineMessages(session.id)
    : [];

  let activeViewers = 0;
  let displayViewerCount = resolveViewerDisplayCount({
    mode: "CONFIGURED_BASELINE",
    baseline: batch.expectedViewerBaseline,
    activeViewers: 0,
  });

  const usesSharedCachedState = batch.viewerDisplayMode === "CONFIGURED_BASELINE";
  if (!usesSharedCachedState) {
    const viewerIdentity = await getOrCreateLiveViewerIdentity();
    const heartbeat = await new LiveRoomService(repository).heartbeat({
      batchId: batch.id,
      sessionId: state.session?.id ?? null,
      viewerTokenHash: viewerIdentity.tokenHash,
      viewerDisplayMode: batch.viewerDisplayMode,
      expectedViewerBaseline: batch.expectedViewerBaseline,
      now,
    });
    activeViewers = heartbeat.activeViewers;
    displayViewerCount = heartbeat.displayViewerCount;
  }

  return NextResponse.json(
    {
      ok: true,
      serverNow: now.toISOString(),
      batch: {
        id: batch.id,
        slug: batch.slug,
        title: batch.title,
        description: batch.description ?? null,
      },
      state: state.state,
      isLive: state.isLive,
      liveOffsetSeconds: state.liveOffsetSeconds,
      nextStartsAt: state.countdownTo?.toISOString() ?? null,
      displayViewerCount,
      activeViewers,
      session: session
        ? {
            id: session.id,
            title: session.title,
            position: session.position,
            startsAt: session.startsAt.toISOString(),
            durationSeconds: session.durationSeconds,
          }
        : null,
      chat: { staged: stagedMessages },
      cta: session?.ctaText && session.ctaUrl
        ? {
            text: session.ctaText,
            url: session.ctaUrl,
            revealOffsetSeconds: session.ctaRevealOffsetSeconds ?? null,
          }
        : null,
      ended: state.state === "ENDED"
        ? {
            message: session?.endedMessage ?? batch.endedMessage ?? "This live class has ended.",
            redirectUrl: session?.endedRedirectUrl ?? batch.endedRedirectUrl ?? null,
          }
        : null,
    },
    {
      headers: usesSharedCachedState
        ? {
            "Cache-Control": LIVE_STATE_CACHE_CONTROL,
            "CDN-Cache-Control": LIVE_STATE_CACHE_CONTROL,
          }
        : {
            "Cache-Control": "private, no-store",
          },
    },
  );
}
