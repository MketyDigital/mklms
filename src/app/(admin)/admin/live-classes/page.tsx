import { AppLayout } from "@/components/layout/app-layout";
import { AdminLiveChatVisibilityControl } from "@/features/live-classes/components/admin-live-chat-visibility-control";
import { AdminLiveClassManager } from "@/features/live-classes/components/admin-live-class-manager";
import { createPostgresAdminLiveClassRepository } from "@/features/live-classes/repositories/live-class-repository.factory";
import { createPostgresLiveClassRepository } from "@/features/live-classes/repositories/live-class-repository.factory";
import { createPostgresAdminMediaRepository } from "@/features/media/repositories/media-repository.factory";
import { createPostgresSettingsRepository } from "@/features/settings/repositories/settings-repository.factory";

export const dynamic = "force-dynamic";

export default async function AdminLiveClassesPage() {
  const repository = createPostgresAdminLiveClassRepository();
  const runtimeRepository = createPostgresLiveClassRepository();
  const [batchRecords, media, settings] = await Promise.all([
    repository.listBatches(),
    createPostgresAdminMediaRepository().listAssets(),
    createPostgresSettingsRepository().getPlatformSettings(),
  ]);

  const batches = await Promise.all(
    batchRecords.map(async (batch) => {
      const sessionRecords = await repository.listSessions(batch.id);
      const sessions = await Promise.all(
        sessionRecords.map(async (session) => {
          const timelineSummary = await repository.getTimelineSummary(session.id);
          return {
            ...session,
            startsAt: session.startsAt.toISOString(),
            timelineCount: timelineSummary.count,
            timelineFirstOffsetSeconds: timelineSummary.firstOffsetSeconds,
            timelineLastOffsetSeconds: timelineSummary.lastOffsetSeconds,
          };
        }),
      );

      return {
        ...batch,
        sessions,
        attendeeMessages: (await runtimeRepository.listAdminAttendeeMessages({ batchId: batch.id })).map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
      };
    }),
  );

  const publicBaseUrl = settings.publicBaseUrl.replace(/\/$/, "");

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
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Live Classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create temporary 1–3 day simulated-live classes, schedule media, import staged chat, set CTA/expiry behavior, and share the public link externally.
          </p>
        </div>
        <AdminLiveChatVisibilityControl batches={batchRecords} />
        <AdminLiveClassManager
          batches={batches}
          media={media}
          publicBaseUrl={publicBaseUrl}
        />
      </div>
    </AppLayout>
  );
}
