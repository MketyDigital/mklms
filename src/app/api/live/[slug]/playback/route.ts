import { NextResponse } from "next/server";

import { PostgresLiveClassRepository } from "@/features/live-classes/repositories/postgres-live-class.repository";
import { getOrCreateLiveViewerIdentity } from "@/features/live-classes/server/live-viewer";
import { LivePlaybackService } from "@/features/live-classes/services/live-playback.service";
import { getConfiguredMediaProvider } from "@/providers/signed-delivery-media-provider";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const repository = new PostgresLiveClassRepository();
  const batch = await repository.findPublicBatchBySlug(slug);
  if (!batch) {
    return NextResponse.json({ ok: false, message: "This live class is not available." }, { status: 404 });
  }

  const viewerIdentity = await getOrCreateLiveViewerIdentity();
  const viewer =
    (await repository.findViewerByTokenHash(batch.id, viewerIdentity.tokenHash)) ??
    (await repository.upsertViewerHeartbeat({
      batchId: batch.id,
      sessionId: null,
      viewerTokenHash: viewerIdentity.tokenHash,
    }));

  try {
    const service = new LivePlaybackService(repository, getConfiguredMediaProvider());
    const result = await service.authorize({ batch, viewerId: viewer.id });
    if (!result.ok) {
      return NextResponse.json(result, { status: result.reason === "NOT_LIVE" ? 409 : 503 });
    }
    return NextResponse.json({
      ...result,
      authorization: result.authorization
        ? {
            ...result.authorization,
            expiresAt: result.authorization.expiresAt?.toISOString() ?? null,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        state: "LIVE",
        reason: "MEDIA_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Live playback is unavailable.",
      },
      { status: 503 },
    );
  }
}
