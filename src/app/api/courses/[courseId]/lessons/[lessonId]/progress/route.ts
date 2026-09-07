import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { ensureCourseCertificate } from "@/features/certificates/server/ensure-course-certificate";
import { getNextDestinationAfterLesson } from "@/features/courses/domain/paid-course-progression";
import { getPublishedCourseStructure } from "@/features/courses/domain/publication";
import { PostgresVideoProgressRepository } from "@/features/media/repositories/postgres-video-progress.repository";
import { VideoProgressService } from "@/features/media/services/video-progress.service";
import { consumeDistributedRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

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

  const { courseId, lessonId } = await context.params;
  const limit = await consumeDistributedRateLimit(
    "STUDENT_MUTATION_RATE_LIMITER",
    `student:${session.studentId}:lesson-progress:${lessonId}`,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many progress updates. Please try again shortly." },
      {
        status: 429,
        headers: { ...rateLimitHeaders(limit), "Cache-Control": "private, no-store" },
      },
    );
  }

  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid progress report." },
      { status: 400 },
    );
  }

  const repository = new PostgresVideoProgressRepository();
  const service = new VideoProgressService(repository);
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

  let nextDestination = null;
  if (result.lessonCompleted) {
    const [rawCourse, enrollment, completedRaw, quizGates, passedQuizIdsRaw] = await Promise.all([
      repository.getCourseStructure(courseId),
      repository.getEnrollment(session.studentId, courseId),
      repository.getCompletedLessonIds(session.studentId, courseId),
      repository.listPublishedQuizGates(courseId),
      repository.getPassedQuizIds(session.studentId, courseId),
    ]);
    const course = rawCourse ? getPublishedCourseStructure(rawCourse) : null;
    if (course && enrollment) {
      nextDestination = getNextDestinationAfterLesson(
        course,
        lessonId,
        new Set(completedRaw),
        quizGates,
        new Set(passedQuizIdsRaw),
        enrollment,
      );
    }
  }

  const certificate = result.courseCompleted
    ? await ensureCourseCertificate(session.studentId, courseId)
    : null;

  return NextResponse.json(
    { ...result, nextDestination, certificate },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
