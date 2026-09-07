import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  PlayCircle,
  Radio,
  ScrollText,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { StudentLearningService } from "@/features/courses/services/student-learning.service";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";
import { resolvePaidLiveState } from "@/features/paid-live/services/paid-live-state.service";
import { PostgresQuizRepository } from "@/features/quizzes/repositories/postgres-quiz.repository";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");

  const { courseId } = await params;
  const learning = new StudentLearningService(new PostgresLearningRepository());
  const quizRepository = new PostgresQuizRepository();
  const paidLiveRepository = new PostgresPaidLiveRepository();
  const [course, quizzes, paidLiveSessions] = await Promise.all([
    learning.getCourseView(session.studentId, courseId),
    quizRepository.listByCourse(courseId, true),
    paidLiveRepository.listByCourse(courseId, true),
  ]);
  if (!course) notFound();

  const totalLessons = course.modules.reduce(
    (total, module) => total + module.lessons.length,
    0,
  );
  const completedLessons = course.modules.reduce(
    (total, module) =>
      total + module.lessons.filter((lesson) => lesson.completed).length,
    0,
  );
  const now = new Date();

  return (
    <AppLayout
      user={{
        name: session.displayName,
        email: session.email ?? "",
        avatar: undefined,
      }}
      isAdmin={false}
      unreadMessages={0}
    >
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" asChild>
          <Link href="/courses">
            <ArrowLeft className="size-4" />
            My Courses
          </Link>
        </Button>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">
                {course.title}
              </h1>
              {course.enrollmentStatus === "COMPLETED" ? (
                <Badge>Completed</Badge>
              ) : null}
            </div>
            {course.description ? (
              <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground">
                {course.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="min-w-0 break-words">
              {completedLessons} of {totalLessons} lessons completed
            </span>
            <span className="shrink-0">{course.progressPercent}%</span>
          </div>
          <Progress value={course.progressPercent} className="h-2" />
          <p className="break-words text-xs text-muted-foreground">
            Watch progress is saved automatically. Course completion requires all published lessons
            {quizzes.length ? ` and all ${quizzes.length} published ${quizzes.length === 1 ? "quiz" : "quizzes"}` : ""}.
          </p>
        </div>

        {paidLiveSessions.length ? (
          <div className="mt-8 space-y-3">
            <h2 className="text-lg font-semibold">Paid live sessions</h2>
            {paidLiveSessions.map((liveSession) => {
              const state = resolvePaidLiveState({
                startsAt: liveSession.startsAt,
                endsAt: liveSession.endsAt,
                now,
              });

              return (
                <Card key={liveSession.id} className="overflow-hidden">
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Radio className="size-4 shrink-0" />
                        <p className="min-w-0 break-words font-medium">{liveSession.title}</p>
                        <Badge variant="outline">{state}</Badge>
                      </div>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {liveSession.startsAt.toLocaleString()} — {liveSession.endsAt.toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      variant={state === "LIVE" ? "default" : "outline"}
                      asChild
                    >
                      <Link href={`/courses/${course.id}/live/${liveSession.id}`}>
                        {state === "LIVE" ? "Join paid live" : "View session"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        <div className="mt-8 space-y-5">
          {course.modules.map((module, moduleIndex) => {
            const moduleQuizzes = quizzes.filter((quiz) => quiz.moduleId === module.id);

            return (
              <Card key={module.id} className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="break-words text-base">
                    Module {moduleIndex + 1}: {module.title}
                  </CardTitle>
                  {module.description ? (
                    <CardDescription className="break-words">{module.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-2">
                  {module.lessons.map((lesson, lessonIndex) => {
                    const content = (
                      <div className="flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/30 sm:px-4">
                        <div className="shrink-0 pt-0.5">
                          {lesson.completed ? (
                            <CheckCircle2 className="size-5 text-foreground" />
                          ) : lesson.locked ? (
                            <LockKeyhole className="size-5 text-muted-foreground" />
                          ) : (
                            <PlayCircle className="size-5 text-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium">
                            Lesson {lessonIndex + 1}: {lesson.title}
                          </p>
                          <p className="mt-0.5 break-words text-xs text-muted-foreground">
                            {lesson.completed
                              ? "Completed"
                              : lesson.locked
                                ? "Complete the required earlier lessons and quizzes to unlock"
                                : lesson.progressPercent > 0
                                  ? `${Math.round(lesson.progressPercent)}% watched and saved`
                                  : "Available"}
                          </p>
                        </div>
                      </div>
                    );

                    return lesson.locked ? (
                      <div key={lesson.id} aria-disabled="true">
                        {content}
                      </div>
                    ) : (
                      <Link
                        key={lesson.id}
                        href={`/courses/${course.id}/lessons/${lesson.id}`}
                        className="block min-w-0"
                      >
                        {content}
                      </Link>
                    );
                  })}

                  {moduleQuizzes.map((quiz) => {
                    const gate = course.quizGates.find((candidate) => candidate.id === quiz.id);
                    const passed = gate?.passed ?? false;
                    const quizLocked = gate?.locked ?? true;
                    const content = (
                      <div className="flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/30 sm:px-4">
                        {passed ? (
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                        ) : quizLocked ? (
                          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ScrollText className="mt-0.5 size-5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium">Quiz: {quiz.title}</p>
                          <p className="mt-0.5 break-words text-xs text-muted-foreground">
                            {passed
                              ? "Passed"
                              : quizLocked
                                ? "Complete this module's required lessons and earlier quizzes to unlock"
                                : `Available — pass mark ${quiz.passMarkPercent}%`}
                          </p>
                        </div>
                      </div>
                    );

                    return quizLocked ? (
                      <div key={quiz.id} aria-disabled="true">
                        {content}
                      </div>
                    ) : (
                      <Link
                        key={quiz.id}
                        href={`/courses/${course.id}/quizzes/${quiz.id}`}
                        className="block min-w-0"
                      >
                        {content}
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          {!course.modules.length ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No lessons have been published for this course yet.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
