import { NextResponse } from "next/server";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { isAllowedZoomUrl } from "@/features/paid-live/domain/model";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";
import { resolvePaidLiveState } from "@/features/paid-live/services/paid-live-state.service";

const PRIVATE_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; sessionId: string }> },
) {
  const student = await getCurrentStudentSession();
  if (!student) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401, headers: PRIVATE_NO_STORE });
  }

  const { courseId, sessionId } = await params;
  const repository = new PostgresPaidLiveRepository();
  const [liveSession, enrollment, courseStatus] = await Promise.all([
    repository.getSession(sessionId),
    repository.getEnrollment(student.studentId, courseId),
    repository.getCourseStatus(courseId),
  ]);

  if (!liveSession || liveSession.courseId !== courseId) {
    return NextResponse.json({ ok: false, message: "Live session not found." }, { status: 404, headers: PRIVATE_NO_STORE });
  }
  if (liveSession.status !== "PUBLISHED" || courseStatus !== "PUBLISHED") {
    return NextResponse.json({ ok: false, message: "This live session is not available." }, { status: 403, headers: PRIVATE_NO_STORE });
  }
  if (!enrollment || !["ACTIVE", "COMPLETED"].includes(enrollment.status)) {
    return NextResponse.json({ ok: false, message: "You are not enrolled in this course." }, { status: 403, headers: PRIVATE_NO_STORE });
  }
  if (liveSession.deliveryMode !== "ZOOM") {
    return NextResponse.json({ ok: false, message: "This session uses protected video playback." }, { status: 409, headers: PRIVATE_NO_STORE });
  }

  const state = resolvePaidLiveState({ startsAt: liveSession.startsAt, endsAt: liveSession.endsAt });
  if (state !== "LIVE") {
    return NextResponse.json(
      { ok: false, state, message: state === "UPCOMING" ? "This Zoom class has not started yet." : "This Zoom class has ended." },
      { status: 409, headers: PRIVATE_NO_STORE },
    );
  }
  if (!liveSession.zoomUrl || !isAllowedZoomUrl(liveSession.zoomUrl)) {
    return NextResponse.json({ ok: false, message: "The Zoom link is not configured correctly." }, { status: 409, headers: PRIVATE_NO_STORE });
  }

  return NextResponse.json(
    { ok: true, state: "LIVE", joinUrl: liveSession.zoomUrl },
    { headers: PRIVATE_NO_STORE },
  );
}
