import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole, PlayCircle } from "lucide-react";
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
  const course = await learning.getCourseView(session.studentId, courseId);
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
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {course.title}
              </h1>
              {course.enrollmentStatus === "COMPLETED" ? (
                <Badge>Completed</Badge>
              ) : null}
            </div>
            {course.description ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {course.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {completedLessons} of {totalLessons} lessons completed
            </span>
            <span>{course.progressPercent}%</span>
          </div>
          <Progress value={course.progressPercent} className="h-2" />
        </div>

        <div className="mt-8 space-y-5">
          {course.modules.map((module, moduleIndex) => (
            <Card key={module.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  Module {moduleIndex + 1}: {module.title}
                </CardTitle>
                {module.description ? (
                  <CardDescription>{module.description}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
                {module.lessons.map((lesson, lessonIndex) => {
                  const content = (
                    <div className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/30">
                      <div className="shrink-0">
                        {lesson.completed ? (
                          <CheckCircle2 className="size-5 text-foreground" />
                        ) : lesson.locked ? (
                          <LockKeyhole className="size-5 text-muted-foreground" />
                        ) : (
                          <PlayCircle className="size-5 text-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Lesson {lessonIndex + 1}: {lesson.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {lesson.completed
                            ? "Completed"
                            : lesson.locked
                              ? "Complete the previous lesson to unlock"
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
                    >
                      {content}
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          ))}

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
