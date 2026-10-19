import { AppLayout } from "@/components/layout/app-layout";
import { AdminCourseManager } from "@/features/courses/components/admin/admin-course-manager";
import { createPostgresAdminLearningRepository } from "@/features/courses/repositories/learning-repository.factory";
import { AdminLearningService } from "@/features/courses/services/admin-learning.service";
import { createPostgresSettingsRepository } from "@/features/settings/repositories/settings-repository.factory";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const [courses, settings] = await Promise.all([
    new AdminLearningService(createPostgresAdminLearningRepository()).listCourses(),
    createPostgresSettingsRepository().getPlatformSettings(),
  ]);

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
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Courses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create reusable courses, then organize them into modules and lessons.
          </p>
        </div>
        <AdminCourseManager initialCourses={courses} />
      </div>
    </AppLayout>
  );
}
