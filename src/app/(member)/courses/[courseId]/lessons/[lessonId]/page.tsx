import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { CompleteLessonButton } from "@/features/courses/components/complete-lesson-button";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { StudentLearningService } from "@/features/courses/services/student-learning.service";
import { ProtectedLessonPlayer } from "@/features/media/components/protected-lesson-player";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");

  const { courseId, lessonId } = await params;
  const learning = new StudentLearningService(new PostgresLearningRepository());
  const course = await learning.getCourseView(session.studentId, courseId);
  if (!course) notFound();

  const lesson = course.modules
    .flatMap((courseModule) => courseModule.lessons)
    .find((item) => item.id === lessonId);

  if (!lesson) notFound();

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
          <Link href={`/courses/${courseId}`}>
            <ArrowLeft className="size-4" />
            Back to course
          </Link>
        </Button>

        {lesson.locked ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockKeyhole className="size-5" />
                Lesson locked
              </CardTitle>
              <CardDescription>
                Complete the required earlier lessons and quizzes before opening this lesson.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="mt-6 space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">{course.title}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {lesson.title}
              </h1>
              {lesson.description ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {lesson.description}
                </p>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lesson media</CardTitle>
                <CardDescription>
                  Media is authorized only after your student session and lesson access are verified.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lesson.mediaAssetId ? (
                  <ProtectedLessonPlayer
                    courseId={courseId}
                    lessonId={lessonId}
                    completionMode={lesson.completionMode}
                    completed={lesson.completed}
                    initialProgressPercent={lesson.progressPercent}
                    initialPositionSeconds={lesson.lastPositionSeconds}
                  />
                ) : (
                  <div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
                    No media asset has been assigned to this lesson yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lesson progress</CardTitle>
                <CardDescription>
                  Progress is saved automatically. Reaching the required watch threshold unlocks the next required step.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lesson.completionMode === "MANUAL" ? (
                  <CompleteLessonButton
                    courseId={courseId}
                    lessonId={lessonId}
                    completed={lesson.completed}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {lesson.completed
                      ? "Lesson completed."
                      : `${Math.round(lesson.progressPercent)}% watch progress saved. Continue watching to reach the required completion threshold.`}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
