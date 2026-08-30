import { AppLayout } from "@/components/layout/app-layout";
import { AdminAccessPanel } from "@/features/access/components/admin/admin-access-panel";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const accessRepository = new PostgresAdminAccessRepository();
  const settingsRepository = new PostgresSettingsRepository();
  const [students, preauthorizations, settings] = await Promise.all([
    accessRepository.listStudents(250),
    accessRepository.listPreauthorizations(250),
    settingsRepository.getPlatformSettings(),
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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Access & enrollments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-authorize paid students, choose how first-time access is verified, issue/reset private access codes, and suspend or restore portal access.
          </p>
        </div>

        <AdminAccessPanel
          initialStudents={students.map((student) => ({
            ...student,
            createdAt: student.createdAt.toISOString(),
          }))}
          initialPreauthorizations={preauthorizations}
          defaultClaimStrategy={settings.claimVerificationStrategy}
        />
      </div>
    </AppLayout>
  );
}
