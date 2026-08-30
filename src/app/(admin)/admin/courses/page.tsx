import { AppLayout } from "@/components/layout/app-layout";
import { AdminCourseManager } from "@/features/courses/components/admin/admin-course-manager";
import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { AdminLearningService } from "@/features/courses/services/admin-learning.service";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const [courses, settings] = await Promise.all([
    new AdminLearningService(new PostgresAdminLearningRepository()).listCourses(),
    new PostgresSettingsRepository().getPlatformSettings(),
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
