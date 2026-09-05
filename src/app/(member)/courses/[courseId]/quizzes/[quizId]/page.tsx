import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { StudentLearningService } from "@/features/courses/services/student-learning.service";
import { StudentQuiz } from "@/features/quizzes/components/student-quiz";
import { PostgresQuizRepository } from "@/features/quizzes/repositories/postgres-quiz.repository";

export const dynamic = "force-dynamic";

export default async function StudentQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");
  const { courseId, quizId } = await params;

  const [course, quiz] = await Promise.all([
    new StudentLearningService(new PostgresLearningRepository()).getCourseView(session.studentId, courseId),
    new PostgresQuizRepository().getQuiz(quizId),
  ]);
  if (!course || !quiz || quiz.courseId !== courseId || quiz.status !== "PUBLISHED") notFound();

  const studentQuiz = {
    id: quiz.id,
    courseId: quiz.courseId,
    title: quiz.title,
    description: quiz.description,
    passMarkPercent: quiz.passMarkPercent,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      choices: question.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    })),
  };

  return (
    <AppLayout user={{ name: session.displayName, email: session.email ?? "", avatar: undefined }} isAdmin={false} unreadMessages={0}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-5" asChild><Link href={`/courses/${courseId}`}><ArrowLeft className="mr-1 size-4" />Back to course</Link></Button>
        <StudentQuiz quiz={studentQuiz} />
      </div>
    </AppLayout>
  );
}
