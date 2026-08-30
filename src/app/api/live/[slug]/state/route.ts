import { NextResponse } from "next/server";

import { LIVE_STATE_CACHE_CONTROL } from "@/features/live-classes/domain/live-client-cache";
import { resolveLiveBatchState, resolveViewerDisplayCount } from "@/features/live-classes/domain/live-session";
import { isLiveCtaVisible } from "@/features/live-classes/domain/live-timeline";
import { PostgresLiveClassRepository } from "@/features/live-classes/repositories/postgres-live-class.repository";

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

  const visibleStaged = session
    ? stagedMessages
        .filter((item) => item.offsetSeconds <= (state.liveOffsetSeconds ?? 0))
        .slice(-20)
    : [];

  const ctaVisible = session && state.state === "LIVE"
    ? isLiveCtaVisible({
        liveOffsetSeconds: state.liveOffsetSeconds ?? 0,
        revealOffsetSeconds: session.ctaRevealOffsetSeconds,
      })
    : false;

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
      displayViewerCount: resolveViewerDisplayCount({
        mode: batch.viewerDisplayMode === "CONFIGURED_BASELINE"
          ? "CONFIGURED_BASELINE"
          : "CONFIGURED_BASELINE",
        baseline: batch.expectedViewerBaseline,
        activeViewers: 0,
      }),
      session: session
        ? {
            id: session.id,
            title: session.title,
            position: session.position,
            startsAt: session.startsAt.toISOString(),
            durationSeconds: session.durationSeconds,
          }
        : null,
      chat: { staged: visibleStaged },
      cta: ctaVisible && session?.ctaText && session.ctaUrl
        ? { text: session.ctaText, url: session.ctaUrl }
        : null,
      ended: state.state === "ENDED"
        ? {
            message: session?.endedMessage ?? batch.endedMessage ?? "This live class has ended.",
            redirectUrl: session?.endedRedirectUrl ?? batch.endedRedirectUrl ?? null,
          }
        : null,
    },
    {
      headers: {
        "Cache-Control": LIVE_STATE_CACHE_CONTROL,
        "CDN-Cache-Control": LIVE_STATE_CACHE_CONTROL,
      },
    },
  );
}
