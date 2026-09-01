import { NextResponse } from "next/server";

import { resolveLiveBatchState } from "@/features/live-classes/domain/live-session";
import { PostgresLiveClassRepository } from "@/features/live-classes/repositories/postgres-live-class.repository";

export const dynamic = "force-dynamic";

const CHAT_CACHE_CONTROL = "public, max-age=0, s-maxage=5";

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
      {
        status: 404,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "CDN-Cache-Control": "no-store",
        },
      },
    );
  }

  const state = resolveLiveBatchState(batch, new Date());
  const session = state.state === "LIVE" && state.session
    ? batch.sessions.find((item) => item.id === state.session?.id) ?? null
    : null;

  if (!session) {
    return NextResponse.json(
      {
        ok: true,
        sessionId: null,
        count: 0,
        firstOffsetSeconds: null,
        lastOffsetSeconds: null,
        messages: [],
      },
      {
        headers: {
          "Cache-Control": CHAT_CACHE_CONTROL,
          "CDN-Cache-Control": CHAT_CACHE_CONTROL,
        },
      },
    );
  }

  const messages = await repository.listTimelineMessages(session.id);
  return NextResponse.json(
    {
      ok: true,
      sessionId: session.id,
      count: messages.length,
      firstOffsetSeconds: messages[0]?.offsetSeconds ?? null,
      lastOffsetSeconds: messages.at(-1)?.offsetSeconds ?? null,
      messages,
    },
    {
      headers: {
        "Cache-Control": CHAT_CACHE_CONTROL,
        "CDN-Cache-Control": CHAT_CACHE_CONTROL,
      },
    },
  );
}
