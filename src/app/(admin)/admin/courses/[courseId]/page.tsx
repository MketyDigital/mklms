import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminCourseBuilder } from "@/features/courses/components/admin/admin-course-builder";
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
  const [course, mediaAssets, settings, quizzes, paidLiveSessions] = await Promise.all([
    new PostgresLearningRepository().getCourseStructure(courseId),
    new PostgresAdminMediaRepository().listAssets(),
    new PostgresSettingsRepository().getPlatformSettings(),
    new PostgresQuizRepository().listByCourse(courseId),
    new PostgresPaidLiveRepository().listByCourse(courseId),
  ]);

  if (!course) notFound();

  const mediaOptions = mediaAssets.map((asset) => ({
    id: asset.id,
    title: asset.title,
    sourceType: asset.sourceType,
    durationSeconds: asset.durationSeconds ?? null,
    status: asset.status,
  }));

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
            Build lessons, quizzes, and enrollment-gated paid live sessions for this course.
          </p>
        </div>

        <div className="space-y-8">
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
