import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { ensureCourseCertificate } from "@/features/certificates/server/ensure-course-certificate";
import { PostgresVideoProgressRepository } from "@/features/media/repositories/postgres-video-progress.repository";
import { VideoProgressService } from "@/features/media/services/video-progress.service";

const progressSchema = z.object({
  grantId: z.string().min(1),
  reportedPercent: z.number().min(0).max(100),
  lastPositionSeconds: z.number().min(0),
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{ courseId: string; lessonId: string }>;
  },
) {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid progress report." },
      { status: 400 },
    );
  }

  const { courseId, lessonId } = await context.params;
  const service = new VideoProgressService(new PostgresVideoProgressRepository());
  const result = await service.reportProgress({
    grantId: parsed.data.grantId,
    studentId: session.studentId,
    courseId,
    lessonId,
    reportedPercent: parsed.data.reportedPercent,
    lastPositionSeconds: parsed.data.lastPositionSeconds,
  });

  if (!result.ok) {
    const status =
      result.reason === "PLAYBACK_GRANT_INVALID"
        ? 403
        : result.reason === "LESSON_LOCKED"
          ? 409
          : 422;
    return NextResponse.json(result, { status });
  }

  const certificate = result.courseCompleted
    ? await ensureCourseCertificate(session.studentId, courseId)
    : null;

  return NextResponse.json(
    { ...result, certificate },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
