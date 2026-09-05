import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveLiveBatchState } from "@/features/live-classes/domain/live-session";
import { PostgresLiveClassRepository } from "@/features/live-classes/repositories/postgres-live-class.repository";
import { getOrCreateLiveViewerIdentity } from "@/features/live-classes/server/live-viewer";
import { LiveAttendeeMessageService } from "@/features/live-classes/services/live-attendee-message.service";
import { LiveRoomService } from "@/features/live-classes/services/live-room.service";
import {
  FixedWindowRateLimiter,
  getRequestClientKey,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { getConfiguredNotificationProvider } from "@/providers/telegram-notification-provider";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  message: z.string().trim().min(1).max(4000),
});
const limiter = new FixedWindowRateLimiter({ limit: 8, windowMs: 60_000 });
const PRIVATE_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
};

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
      { status: 404, headers: PRIVATE_NO_STORE },
    );
  }

  const state = resolveLiveBatchState(batch, new Date());
  if (state.state !== "LIVE" || !state.session) {
    return NextResponse.json(
      { ok: true, sessionId: null, shared: [] },
      { headers: PRIVATE_NO_STORE },
    );
  }

  if (batch.attendeeChatVisibility !== "PUBLIC") {
    return NextResponse.json(
      { ok: true, sessionId: state.session.id, shared: [] },
      { headers: PRIVATE_NO_STORE },
    );
  }

  const viewerIdentity = await getOrCreateLiveViewerIdentity();
  const existingViewer = await repository.findViewerByTokenHash(batch.id, viewerIdentity.tokenHash);
  const viewer = existingViewer ?? await repository.upsertViewerHeartbeat({
    batchId: batch.id,
    sessionId: state.session.id,
    viewerTokenHash: viewerIdentity.tokenHash,
  });
  const result = await new LiveRoomService(repository).getPublicChat({
    viewerId: viewer.id,
    sessionId: state.session.id,
    liveOffsetSeconds: state.liveOffsetSeconds ?? 0,
    stagedMessages: [],
    attendeeChatVisibility: batch.attendeeChatVisibility,
  });
  const shared = "shared" in result ? result.shared : [];

  return NextResponse.json(
    {
      ok: true,
      sessionId: state.session.id,
      shared: shared.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
    },
    { headers: PRIVATE_NO_STORE },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const limit = limiter.consume(getRequestClientKey(request, `live-message:${slug}`));
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "You are sending comments too quickly. Try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Enter a valid comment." }, { status: 400 });
  }

  const repository = new PostgresLiveClassRepository();
  const batch = await repository.findPublicBatchBySlug(slug);
  if (!batch) {
    return NextResponse.json({ ok: false, message: "This live class is not available." }, { status: 404 });
  }

  const state = resolveLiveBatchState(batch, new Date());
  if (state.state !== "LIVE" || !state.session) {
    return NextResponse.json({ ok: false, message: "Comments are available while the class is live." }, { status: 409 });
  }

  const viewerIdentity = await getOrCreateLiveViewerIdentity();
  const viewer = await repository.upsertViewerHeartbeat({
    batchId: batch.id,
    sessionId: state.session.id,
    viewerTokenHash: viewerIdentity.tokenHash,
    displayName: parsed.data.displayName ?? null,
  });

  const service = new LiveAttendeeMessageService(
    repository,
    getConfiguredNotificationProvider(),
  );
  const result = await service.send({
    batchId: batch.id,
    sessionId: state.session.id,
    viewerId: viewer.id,
    displayName: parsed.data.displayName,
    message: parsed.data.message,
    batchTitle: batch.title,
    sessionTitle: state.session.title,
    notificationDestination: batch.notificationDestination,
  });

  return NextResponse.json({
    ok: true,
    notificationDelivered: result.notificationDelivered,
    message: {
      ...result.message,
      createdAt: result.message.createdAt.toISOString(),
    },
  });
}
