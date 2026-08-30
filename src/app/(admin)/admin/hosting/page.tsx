import { AppLayout } from "@/components/layout/app-layout";
import { ManagedHostingPanel } from "@/features/hosting/components/managed-hosting-panel";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminHostingPage() {
  const hostingRepository = new PostgresManagedHostingRepository();
  const settingsRepository = new PostgresSettingsRepository();
  const [hostingSettings, usage, platformSettings] = await Promise.all([
    hostingRepository.getSettings(),
    hostingRepository.getCurrentMonthUsage(),
    settingsRepository.getPlatformSettings(),
  ]);

  return (
    <AppLayout
      user={{
        name: platformSettings.supportName ?? platformSettings.organizationName,
        email: platformSettings.supportEmail ?? "",
        avatar: undefined,
      }}
      isAdmin={true}
      unreadMessages={0}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Hosting & Usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transparent usage signals, media-processing estimates and optional managed-hosting payment details.
          </p>
        </div>
        <ManagedHostingPanel initialSettings={hostingSettings} usage={usage} />
      </div>
    </AppLayout>
  );
}
