import { AppLayout } from "@/components/layout/app-layout";
import { AdminCertificateManager } from "@/features/certificates/components/admin-certificate-manager";
import { PostgresCertificateRepository } from "@/features/certificates/repositories/postgres-certificate.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage() {
  const [certificates, settings] = await Promise.all([
    new PostgresCertificateRepository().listAll(),
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
          <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review issued certificates, regenerate PDFs, resend delivery, revoke, or restore validity.
          </p>
        </div>
        <AdminCertificateManager certificates={certificates} />
      </div>
    </AppLayout>
  );
}
