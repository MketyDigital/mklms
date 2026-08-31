import { AppLayout } from "@/components/layout/app-layout";
import { AdminMediaManager } from "@/features/media/components/admin-media-manager";
import { MediaUploadPanel } from "@/features/media/components/media-upload-panel";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const [assets, settings] = await Promise.all([
    new PostgresAdminMediaRepository().listAssets(),
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
          <h1 className="text-2xl font-semibold tracking-tight">Media library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload protected MP4 files to private storage or register reusable media records for course lessons and live classes.
          </p>
        </div>
        <div className="space-y-8">
          <MediaUploadPanel />
          <AdminMediaManager initialAssets={assets} />
        </div>
      </div>
    </AppLayout>
  );
}
