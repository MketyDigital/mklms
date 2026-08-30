import { AppLayout } from "@/components/layout/app-layout";
import { AdminMediaManager } from "@/features/media/components/admin-media-manager";
import { MediaIngestPanel } from "@/features/media/components/media-ingest-panel";
import { getOciAutomationStatus } from "@/features/media/domain/media-ingest";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { PostgresMediaIngestRepository } from "@/features/media/repositories/postgres-media-ingest.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const [assets, ingestJobs, settings] = await Promise.all([
    new PostgresAdminMediaRepository().listAssets(),
    new PostgresMediaIngestRepository().listJobs(),
    new PostgresSettingsRepository().getPlatformSettings(),
  ]);
  const automation = getOciAutomationStatus();

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
            Manage reusable video/media records independently from course lessons and live classes. OCI Media Flow is an ingest processor; final HLS may live on R2 for both surfaces.
          </p>
        </div>
        <div className="space-y-8">
          <MediaIngestPanel
            automation={automation}
            initialJobs={ingestJobs.map((job) => ({
              id: job.id,
              title: job.title,
              state: job.state,
              durationMinutes: job.durationMinutes,
              estimatedCostUsd: job.estimatedCostUsd,
              costAcceptedAt: job.costAcceptedAt?.toISOString() ?? null,
              sourceObjectKey: job.sourceObjectKey,
              ociJobId: job.ociJobId,
              ociOutputPrefix: job.ociOutputPrefix,
              r2Prefix: job.r2Prefix,
              r2MasterManifest: job.r2MasterManifest,
            }))}
          />
          <AdminMediaManager initialAssets={assets} />
        </div>
      </div>
    </AppLayout>
  );
}
