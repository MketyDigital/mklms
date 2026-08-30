import { AppLayout } from "@/components/layout/app-layout";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await new PostgresSettingsRepository().getPlatformSettings();

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
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure branding, access rules, certificate identifiers, and provider adapters for this deployment.
          </p>
        </div>
        <SettingsForm settings={settings} />
      </div>
    </AppLayout>
  );
}
