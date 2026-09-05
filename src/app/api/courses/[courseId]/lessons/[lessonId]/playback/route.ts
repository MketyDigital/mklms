import { NextResponse } from "next/server";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { getManagedHostingServiceAccess } from "@/features/hosting/server/managed-hosting-access";
import { PostgresMediaPlaybackRepository } from "@/features/media/repositories/postgres-media-playback.repository";
import { MediaPlaybackService } from "@/features/media/services/media-playback.service";
import { consumeDistributedRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { getConfiguredMediaProvider } from "@/providers/signed-delivery-media-provider";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ courseId: string; lessonId: string }>;
  },
) {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const { courseId, lessonId } = await context.params;
  const limit = await consumeDistributedRateLimit(
    "PLAYBACK_RATE_LIMITER",
    `student:${session.studentId}:lesson-playback:${lessonId}`,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many playback requests. Please try again shortly." },
      { status: 429, headers: { ...rateLimitHeaders(limit), "Cache-Control": "private, no-store" } },
    );
  }

  const hostingAccess = await getManagedHostingServiceAccess();
  if (!hostingAccess.allowed) {
    return NextResponse.json(
      {
        ok: false,
        reason: "HOSTING_PAYMENT_REQUIRED",
        message: "Protected course video is temporarily unavailable because the site owner's managed hosting payment is overdue.",
      },
      { status: 402, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const service = new MediaPlaybackService(
      new PostgresMediaPlaybackRepository(),
      getConfiguredMediaProvider(),
      { ttlSeconds: 300 },
    );

    const result = await service.authorizeLessonPlayback(
      session.studentId,
      courseId,
      lessonId,
      { sessionExpiresAt: session.expiresAt },
    );

    if (!result.ok) {
      const status =
        result.reason === "COURSE_NOT_AVAILABLE" ||
        result.reason === "LESSON_NOT_AVAILABLE" ||
        result.reason === "MEDIA_NOT_AVAILABLE"
          ? 404
          : result.reason === "LESSON_LOCKED"
            ? 409
            : 403;

      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "PLAYBACK_CONFIGURATION_ERROR",
        message: "Protected playback is unavailable.",
      },
      { status: 503 },
    );
  }
}
