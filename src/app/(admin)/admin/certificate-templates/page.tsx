import { AppLayout } from "@/components/layout/app-layout";
import { AdminCertificateTemplateManager } from "@/features/certificates/components/admin-certificate-template-manager";
import { PostgresCertificateTemplateRepository } from "@/features/certificates/repositories/postgres-certificate-template.repository";
import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminCertificateTemplatesPage() {
  const [templates, courses, settings] = await Promise.all([
    new PostgresCertificateTemplateRepository().listTemplates(),
    new PostgresAdminLearningRepository().listCourses(),
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
          <h1 className="text-2xl font-semibold tracking-tight">Certificate templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload an existing certificate design and configure where MkLMS places the student name, completion date, and certificate ID.
          </p>
        </div>
        <AdminCertificateTemplateManager
          courses={courses.map((course) => ({ id: course.id, title: course.title }))}
          templates={templates}
        />
      </div>
    </AppLayout>
  );
}
