import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { AdminCourseAudienceManager } from "@/features/courses/components/admin/admin-course-audience-manager";
import { AdminCourseBuilder } from "@/features/courses/components/admin/admin-course-builder";
import { PostgresCourseAudienceRepository } from "@/features/courses/repositories/postgres-course-audience.repository";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { AdminPaidLiveEditor } from "@/features/paid-live/components/admin-paid-live-editor";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";
import { AdminQuizEditor } from "@/features/quizzes/components/admin-quiz-editor";
import { PostgresQuizRepository } from "@/features/quizzes/repositories/postgres-quiz.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminCourseBuilderPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, mediaAssets, settings, quizzes, paidLiveSessions, students, audience] = await Promise.all([
    new PostgresLearningRepository().getCourseStructure(courseId),
    new PostgresAdminMediaRepository().listAssets(),
    new PostgresSettingsRepository().getPlatformSettings(),
    new PostgresQuizRepository().listByCourse(courseId),
    new PostgresPaidLiveRepository().listByCourse(courseId),
    new PostgresAdminAccessRepository().listStudents(5000),
    new PostgresCourseAudienceRepository().getCourseAudience(courseId),
  ]);

  if (!course || !audience) notFound();

  const mediaOptions = mediaAssets.map((asset) => ({
    id: asset.id,
    title: asset.title,
    sourceType: asset.sourceType,
    durationSeconds: asset.durationSeconds ?? null,
    status: asset.status,
  }));
  const activeStudents = students
    .filter((student) => student.status === "ACTIVE")
    .map((student) => ({
      id: student.id,
      displayName: student.displayName,
      email: student.email ?? null,
      phone: student.phone ?? null,
    }));
  const activeStudentIds = new Set(activeStudents.map((student) => student.id));
  const selectedActiveStudentIds = audience.enrolledStudentIds.filter((studentId) =>
    activeStudentIds.has(studentId),
  );

  return (
    <AppLayout
      user={{
        name: settings.supportName ?? settings.organizationName,
        email: settings.supportEmail ?? "",
        avatar: undefined,
      }}
      isAdmin={true}
      unreadMessages={0}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" asChild>
          <Link href="/admin/courses">
            <ArrowLeft className="size-4" />
            Courses
          </Link>
        </Button>

        <div className="mt-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
            <Badge variant="outline">{course.status}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Control course access, build lessons and quizzes, and schedule enrollment-gated paid live sessions.
          </p>
        </div>

        <div className="space-y-8">
          <AdminCourseAudienceManager
            courseId={course.id}
            initialMode={audience.mode}
            students={activeStudents}
            initiallyEnrolledStudentIds={selectedActiveStudentIds}
          />
          <AdminCourseBuilder course={course} mediaAssets={mediaOptions} />
          <AdminQuizEditor
            modules={course.modules.map((courseModule) => ({ id: courseModule.id, title: courseModule.title }))}
            initialQuizzes={quizzes}
          />
          <AdminPaidLiveEditor
            courseId={course.id}
            sessions={paidLiveSessions}
            mediaAssets={mediaOptions.map((asset) => ({ id: asset.id, title: asset.title, status: asset.status }))}
          />
        </div>
      </div>
    </AppLayout>
  );
}
