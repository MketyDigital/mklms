import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { calculateCourseProgress } from "@/features/courses/domain/progress";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { PostgresQuizRepository } from "@/features/quizzes/repositories/postgres-quiz.repository";
import { scoreQuizAttempt } from "@/features/quizzes/services/quiz-scoring.service";

const schema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), choiceId: z.string().min(1) })).max(200),
});

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string; quizId: string }> }) {
  const session = await getCurrentStudentSession();
  if (!session) return NextResponse.json({ ok: false, message: "Authentication required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid quiz answers." }, { status: 400 });

  const { courseId, quizId } = await params;
  const quizzes = new PostgresQuizRepository();
  const learning = new PostgresLearningRepository();
  const [quiz, enrollment, course] = await Promise.all([
    quizzes.getQuiz(quizId),
    quizzes.getEnrollment(session.studentId, courseId),
    learning.getCourseStructure(courseId),
  ]);

  if (!quiz || quiz.courseId !== courseId || quiz.status !== "PUBLISHED" || !course || course.status !== "PUBLISHED") {
    return NextResponse.json({ ok: false, message: "This quiz is not available." }, { status: 404 });
  }
  if (!enrollment || !["ACTIVE", "COMPLETED"].includes(enrollment.status)) {
    return NextResponse.json({ ok: false, message: "Active course enrollment is required." }, { status: 403 });
  }
  if (!quiz.questions.length || quiz.questions.some((question) => question.choices.length < 2)) {
    return NextResponse.json({ ok: false, message: "This quiz is not ready for attempts." }, { status: 409 });
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

  if (scored.passed && enrollment.status !== "COMPLETED") {
    const [completedLessons, allQuizzesPassed] = await Promise.all([
      learning.getCompletedLessonIds(session.studentId, courseId),
      quizzes.allPublishedQuizzesPassed(session.studentId, courseId),
    ]);
    if (calculateCourseProgress(course, completedLessons) === 100 && allQuizzesPassed) {
      await learning.markEnrollmentCompleted(session.studentId, courseId);
    }
  }

  return NextResponse.json({
    ok: true,
    attemptId,
    scorePercent: scored.scorePercent,
    passed: scored.passed,
    correctAnswers: scored.correctAnswers,
    totalQuestions: scored.totalQuestions,
  });
}
