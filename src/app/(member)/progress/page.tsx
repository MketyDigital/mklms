import Link from "next/link";
import { redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { StudentLearningService } from "@/features/courses/services/student-learning.service";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");

  const courses = await new StudentLearningService(
    new PostgresLearningRepository(),
  ).listMyCourses(session.studentId);

  const completedCourses = courses.filter(
    (course) => course.enrollmentStatus === "COMPLETED",
  ).length;

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
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track completed lessons and overall course completion.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active courses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{courses.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed courses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{completedCourses}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 space-y-4">
          {courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/30">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{course.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {course.completedLessons} of {course.totalLessons} lessons completed
                      </CardDescription>
                    </div>
                    {course.enrollmentStatus === "COMPLETED" ? (
                      <Badge>Completed</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Course progress</span>
                    <span>{course.progressPercent}%</span>
                  </div>
                  <Progress value={course.progressPercent} className="h-2" />
                </CardContent>
              </Card>
            </Link>
          ))}

          {!courses.length ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No active published course enrollment is available yet.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
