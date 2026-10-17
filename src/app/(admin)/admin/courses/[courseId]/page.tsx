import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminCourseAudienceManager } from "@/features/courses/components/admin/admin-course-audience-manager";
import { AdminCourseBuilder } from "@/features/courses/components/admin/admin-course-builder";
import { createPostgresCourseAudienceRepository } from "@/features/courses/repositories/course-audience-repository.factory";
import { createPostgresLearningRepository } from "@/features/courses/repositories/learning-repository.factory";
import { createPostgresAdminMediaRepository } from "@/features/media/repositories/media-repository.factory";
import { AdminPaidLiveEditor } from "@/features/paid-live/components/admin-paid-live-editor";
import { createPostgresPaidLiveRepository } from "@/features/paid-live/repositories/paid-live-repository.factory"
import { AdminQuizEditor } from "@/features/quizzes/components/admin-quiz-editor";
import { createPostgresQuizRepository } from "@/features/quizzes/repositories/quiz-repository.factory";
import { createPostgresSettingsRepository } from "@/features/settings/repositories/settings-repository.factory";

export const dynamic = "force-dynamic";

export default async function AdminCourseBuilderPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const audienceRepository = createPostgresCourseAudienceRepository();
  const [course, mediaAssets, settings, quizzes, paidLiveSessions, activeStudents, audience] = await Promise.all([
    createPostgresLearningRepository().getCourseStructure(courseId),
    createPostgresAdminMediaRepository().listAssets(),
    createPostgresSettingsRepository().getPlatformSettings(),
    createPostgresQuizRepository().listByCourse(courseId),
    createPostgresPaidLiveRepository().listByCourse(courseId),
    audienceRepository.listActiveStudents(),
    audienceRepository.getCourseAudience(courseId),
  ]);

  if (!course || !audience) notFound();

  const mediaOptions = mediaAssets.map((asset) => ({
    id: asset.id,
    title: asset.title,
    sourceType: asset.sourceType,
    durationSeconds: asset.durationSeconds ?? null,
    status: asset.status,
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
