import { NextResponse } from "next/server";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { ensureCourseCertificate } from "@/features/certificates/server/ensure-course-certificate";
import { getNextDestinationAfterLesson } from "@/features/courses/domain/paid-course-progression";
import { getPublishedCourseStructure } from "@/features/courses/domain/publication";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { LearningProgressService } from "@/features/courses/services/learning-progress.service";
import { consumeDistributedRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

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
    "STUDENT_MUTATION_RATE_LIMITER",
    `student:${session.studentId}:lesson-complete:${lessonId}`,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many completion requests. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const repository = new PostgresLearningRepository();
  const service = new LearningProgressService(repository);
  const result = await service.completeLesson(session.studentId, courseId, lessonId);

  if (!result.ok) {
    const status =
      result.reason === "COURSE_NOT_FOUND"
        ? 404
        : result.reason === "LESSON_LOCKED"
          ? 409
          : 403;

    const message =
      result.reason === "LESSON_LOCKED"
        ? "Complete the required earlier lessons and quizzes before continuing."
        : result.reason === "COMPLETION_NOT_ALLOWED"
          ? "This lesson is completed automatically by its configured learning activity."
          : "This lesson is not currently available for your enrollment.";

    return NextResponse.json(
      { ok: false, reason: result.reason, message },
      { status },
    );
  }

  const [rawCourse, enrollment, completedRaw, quizGates, passedQuizIdsRaw] = await Promise.all([
    repository.getCourseStructure(courseId),
    repository.getEnrollment(session.studentId, courseId),
    repository.getCompletedLessonIds(session.studentId, courseId),
    repository.listPublishedQuizGates(courseId),
    repository.getPassedQuizIds(session.studentId, courseId),
  ]);
  const course = rawCourse ? getPublishedCourseStructure(rawCourse) : null;
  const nextDestination = course && enrollment
    ? getNextDestinationAfterLesson(
        course,
        lessonId,
        new Set(completedRaw),
        quizGates,
        new Set(passedQuizIdsRaw),
        enrollment,
      )
    : null;

  const certificate = result.courseCompleted
    ? await ensureCourseCertificate(session.studentId, courseId)
    : null;

  return NextResponse.json({ ...result, nextDestination, certificate });
}
