import { NextResponse } from "next/server";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";
import { resolvePaidLiveState } from "@/features/paid-live/services/paid-live-state.service";
import { getConfiguredMediaProvider } from "@/providers/signed-delivery-media-provider";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; sessionId: string }> },
) {
  const studentSession = await getCurrentStudentSession();
  if (!studentSession) {
    return NextResponse.json({ ok: false, message: "Authentication required." }, { status: 401 });
  }

  const { courseId, sessionId } = await params;
  const repository = new PostgresPaidLiveRepository();
  const [paidLive, enrollment, courseStatus] = await Promise.all([
    repository.getSession(sessionId),
    repository.getEnrollment(studentSession.studentId, courseId),
    repository.getCourseStatus(courseId),
  ]);

  if (!paidLive || paidLive.courseId !== courseId || paidLive.status !== "PUBLISHED" || courseStatus !== "PUBLISHED") {
    return NextResponse.json({ ok: false, message: "This paid live session is not available." }, { status: 404 });
  }
  if (!enrollment || !["ACTIVE", "COMPLETED"].includes(enrollment.status)) {
    return NextResponse.json({ ok: false, message: "Active course enrollment is required." }, { status: 403 });
  }
  if (paidLive.deliveryMode !== "MEDIA") {
    return NextResponse.json({ ok: false, message: "This paid live session is a Zoom class." }, { status: 409 });
  }

  const now = new Date();
  const state = resolvePaidLiveState({ startsAt: paidLive.startsAt, endsAt: paidLive.endsAt, now });
  if (state !== "LIVE") {
    return NextResponse.json({ ok: false, state, message: state === "UPCOMING" ? "This paid live session has not started yet." : "This paid live session has ended." }, { status: 409 });
  }
  if (!paidLive.mediaAssetId) {
    return NextResponse.json({ ok: false, state, message: "Paid live media has not been configured." }, { status: 503 });
  }

  const asset = await repository.getMediaAsset(paidLive.mediaAssetId);
  if (!asset || asset.status !== "READY" || !asset.providerAssetId) {
    return NextResponse.json({ ok: false, state, message: "Paid live media is not ready." }, { status: 503 });
  }

  const secondsToLiveEnd = Math.max(1, Math.floor((paidLive.endsAt.getTime() - now.getTime()) / 1000));
  const secondsToSessionEnd = Math.max(1, Math.floor((studentSession.expiresAt.getTime() - now.getTime()) / 1000));
  const ttlSeconds = Math.max(1, Math.min(300, secondsToLiveEnd, secondsToSessionEnd));
  const authorization = await getConfiguredMediaProvider().createPlaybackAuthorization(asset, {
    studentId: studentSession.studentId,
    courseId,
    lessonId: null,
    viewerId: null,
    now,
    ttlSeconds,
  });

  return NextResponse.json({
    ok: true,
    state,
    session: {
      id: paidLive.id,
      title: paidLive.title,
      startsAt: paidLive.startsAt.toISOString(),
      endsAt: paidLive.endsAt.toISOString(),
    },
    authorization: {
      ...authorization,
      expiresAt: authorization.expiresAt?.toISOString() ?? null,
    },
  });
}
