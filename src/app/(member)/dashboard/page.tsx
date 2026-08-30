import Link from "next/link";
import { redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { StudentLearningService } from "@/features/courses/services/student-learning.service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back, {session.displayName.split(" ")[0] || session.displayName}.
            </p>
          </div>
          <Badge variant="secondary">Student access active</Badge>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">My courses</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-semibold">{courses.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-semibold">{completedCourses}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild><Link href="/messages">Open inbox</Link></Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">My courses</h2>
            <p className="text-sm text-muted-foreground">Continue from your current course progress.</p>
          </div>
          <Button variant="outline" size="sm" asChild><Link href="/progress">View all progress</Link></Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="block">
              <Card className="h-full transition-colors hover:bg-muted/30">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{course.title}</CardTitle>
                    {course.enrollmentStatus === "COMPLETED" ? <Badge>Completed</Badge> : null}
                  </div>
                  <CardDescription>
                    {course.completedLessons} of {course.totalLessons} lessons completed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span><span>{course.progressPercent}%</span>
                  </div>
                  <Progress value={course.progressPercent} className="h-2" />
                </CardContent>
              </Card>
            </Link>
          ))}
          {!courses.length ? (
            <Card className="sm:col-span-2">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No active published course is assigned to this account yet.
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Live classes</CardTitle>
            <CardDescription>
              Scheduled live-class access will appear here when the live-class module is configured.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AppLayout>
  );
}
