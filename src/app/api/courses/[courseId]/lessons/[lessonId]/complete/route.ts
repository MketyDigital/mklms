import { NextResponse } from "next/server";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { ensureCourseCertificate } from "@/features/certificates/server/ensure-course-certificate";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { LearningProgressService } from "@/features/courses/services/learning-progress.service";

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
  const service = new LearningProgressService(new PostgresLearningRepository());
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
        ? "Complete the previous lesson before continuing."
        : result.reason === "COMPLETION_NOT_ALLOWED"
          ? "This lesson is completed automatically by its configured learning activity."
          : "This lesson is not currently available for your enrollment.";

    return NextResponse.json(
      { ok: false, reason: result.reason, message },
      { status },
    );
  }

  const certificate = result.courseCompleted
    ? await ensureCourseCertificate(session.studentId, courseId)
    : null;

  return NextResponse.json({ ...result, certificate });
}
