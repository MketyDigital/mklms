import { NextResponse } from "next/server";

import { resolveLiveBatchState } from "@/features/live-classes/domain/live-session";
import { isLiveCtaVisible } from "@/features/live-classes/domain/live-timeline";
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
      { status: 404 },
    );
  }

  const now = new Date();
  const state = resolveLiveBatchState(batch, now);
  const viewerIdentity = await getOrCreateLiveViewerIdentity();
  const room = new LiveRoomService(repository);
  const heartbeat = await room.heartbeat({
    batchId: batch.id,
    sessionId: state.session?.id ?? null,
    viewerTokenHash: viewerIdentity.tokenHash,
    viewerDisplayMode: batch.viewerDisplayMode,
    expectedViewerBaseline: batch.expectedViewerBaseline,
    now,
  });

  const session = state.session
    ? batch.sessions.find((item) => item.id === state.session?.id) ?? null
    : null;
  const stagedMessages = session
    ? await repository.listTimelineMessages(session.id)
    : [];
  const chat = await room.getPublicChat({
    viewerId: heartbeat.viewerId,
    liveOffsetSeconds: state.liveOffsetSeconds ?? 0,
    stagedMessages,
  });

  const ctaVisible = session && state.state === "LIVE"
    ? isLiveCtaVisible({
        liveOffsetSeconds: state.liveOffsetSeconds ?? 0,
        revealOffsetSeconds: session.ctaRevealOffsetSeconds,
      })
    : false;

  return NextResponse.json({
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
    displayViewerCount: heartbeat.displayViewerCount,
    activeViewers: heartbeat.activeViewers,
    session: session
      ? {
          id: session.id,
          title: session.title,
          position: session.position,
          startsAt: session.startsAt.toISOString(),
          durationSeconds: session.durationSeconds,
        }
      : null,
    chat: {
      staged: chat.staged,
      own: chat.own.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    },
    cta: ctaVisible && session?.ctaText && session.ctaUrl
      ? { text: session.ctaText, url: session.ctaUrl }
      : null,
    ended: state.state === "ENDED"
      ? {
          message: session?.endedMessage ?? batch.endedMessage ?? "This live class has ended.",
          redirectUrl: session?.endedRedirectUrl ?? batch.endedRedirectUrl ?? null,
        }
      : null,
  });
}
