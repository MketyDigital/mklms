import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { ensureCourseCertificate } from "@/features/certificates/server/ensure-course-certificate";
import {
  areCourseRequirementsComplete,
  canAccessQuiz,
  getNextDestinationAfterQuiz,
} from "@/features/courses/domain/paid-course-progression";
import { getPublishedCourseStructure } from "@/features/courses/domain/publication";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { PostgresQuizRepository } from "@/features/quizzes/repositories/postgres-quiz.repository";
import { scoreQuizAttempt } from "@/features/quizzes/services/quiz-scoring.service";
import { consumeDistributedRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

const schema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), choiceId: z.string().min(1) })).max(200),
});

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string; quizId: string }> }) {
  const session = await getCurrentStudentSession();
  if (!session) return NextResponse.json({ ok: false, message: "Authentication required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid quiz answers." }, { status: 400 });

  const { courseId, quizId } = await params;
  const limit = await consumeDistributedRateLimit(
    "STUDENT_MUTATION_RATE_LIMITER",
    `student:${session.studentId}:quiz:${quizId}`,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many quiz attempts. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const quizzes = new PostgresQuizRepository();
  const learning = new PostgresLearningRepository();
  const [quiz, enrollment, rawCourse, publishedQuizzes, completedLessonsRaw, passedQuizIdsRaw] = await Promise.all([
    quizzes.getQuiz(quizId),
    quizzes.getEnrollment(session.studentId, courseId),
    learning.getCourseStructure(courseId),
    quizzes.listByCourse(courseId, true),
    learning.getCompletedLessonIds(session.studentId, courseId),
    quizzes.getPassedQuizIds(session.studentId, courseId),
  ]);
  const course = rawCourse ? getPublishedCourseStructure(rawCourse) : null;

  if (!quiz || quiz.courseId !== courseId || quiz.status !== "PUBLISHED" || !course) {
    return NextResponse.json({ ok: false, message: "This quiz is not available." }, { status: 404 });
  }
  if (!enrollment || !["ACTIVE", "COMPLETED"].includes(enrollment.status)) {
    return NextResponse.json({ ok: false, message: "Active course enrollment is required." }, { status: 403 });
  }
  if (!quiz.questions.length || quiz.questions.some((question) => question.choices.length < 2)) {
    return NextResponse.json({ ok: false, message: "This quiz is not ready for attempts." }, { status: 409 });
  }

  const quizGates = publishedQuizzes.map((item) => ({
    id: item.id,
    moduleId: item.moduleId,
    position: item.position,
  }));
  const completedLessons = new Set(completedLessonsRaw);
  const passedQuizIds = new Set(passedQuizIdsRaw);

  if (!canAccessQuiz(course, quizId, completedLessons, quizGates, passedQuizIds, enrollment)) {
    return NextResponse.json(
      { ok: false, message: "Complete the required lessons and earlier quizzes before taking this quiz." },
      { status: 409 },
    );
  }

  const scored = scoreQuizAttempt(quiz, parsed.data.answers);
  const attemptId = await quizzes.recordAttempt({
    studentId: session.studentId,
    courseId,
    quizId,
    scorePercent: scored.scorePercent,
    passed: scored.passed,
    answers: scored.answers,
  });

  let courseCompleted = enrollment.status === "COMPLETED";
  let certificate = null;
  let nextDestination = null;

  if (scored.passed) {
    passedQuizIds.add(quizId);
    courseCompleted = areCourseRequirementsComplete(
      course,
      completedLessons,
      quizGates,
      passedQuizIds,
    );

    if (courseCompleted && enrollment.status !== "COMPLETED") {
      await learning.markEnrollmentCompleted(session.studentId, courseId);
    }

    if (courseCompleted) {
      certificate = await ensureCourseCertificate(session.studentId, courseId);
    }

    nextDestination = getNextDestinationAfterQuiz(
      course,
      quizId,
      completedLessons,
      quizGates,
      passedQuizIds,
      courseCompleted ? { ...enrollment, status: "COMPLETED" } : enrollment,
    );
  }

  return NextResponse.json({
    ok: true,
    attemptId,
    scorePercent: scored.scorePercent,
    passed: scored.passed,
    correctAnswers: scored.correctAnswers,
    totalQuestions: scored.totalQuestions,
    courseCompleted,
    certificate,
    nextDestination,
  });
}
