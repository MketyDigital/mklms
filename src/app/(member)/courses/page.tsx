import Link from "next/link";
import { redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { StudentLearningService } from "@/features/courses/services/student-learning.service";

export const dynamic = "force-dynamic";

export default async function CourseCatalogPage() {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");

  const learning = new StudentLearningService(new PostgresLearningRepository());
  const courses = await learning.listMyCourses(session.studentId);

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
          <h1 className="text-2xl font-semibold tracking-tight">My Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Courses currently assigned to your learning account.
          </p>
        </div>

        {courses.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="block">
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-base">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {course.description || "Continue your enrolled course."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {course.completedLessons} of {course.totalLessons} lessons completed
                      </span>
                      <span>{course.progressPercent}%</span>
                    </div>
                    <Progress value={course.progressPercent} className="h-2" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="mt-8">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No active course enrollment is assigned to this account yet.
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
