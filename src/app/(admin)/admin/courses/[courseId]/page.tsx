import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminCourseBuilder } from "@/features/courses/components/admin/admin-course-builder";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminCourseBuilderPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, mediaAssets, settings] = await Promise.all([
    new PostgresLearningRepository().getCourseStructure(courseId),
    new PostgresAdminMediaRepository().listAssets(),
    new PostgresSettingsRepository().getPlatformSettings(),
  ]);

  if (!course) notFound();

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
            Build the course structure as ordered modules and lessons. Media delivery remains provider-neutral.
          </p>
        </div>

        <AdminCourseBuilder
          course={course}
          mediaAssets={mediaAssets.map((asset) => ({
            id: asset.id,
            title: asset.title,
            sourceType: asset.sourceType,
            durationSeconds: asset.durationSeconds ?? null,
            status: asset.status,
          }))}
        />
      </div>
    </AppLayout>
  );
}
