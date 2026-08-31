import { AlertTriangle } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManagedHostingPanel } from "@/features/hosting/components/managed-hosting-panel";
import type { ManagedHostingMonthOverride } from "@/features/hosting/domain/managed-hosting";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import { getManagedHostingPolicy } from "@/features/hosting/server/managed-hosting-policy";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminHostingPage() {
  const hostingRepository = new PostgresManagedHostingRepository();
  const settingsRepository = new PostgresSettingsRepository();
  const platformSettings = await settingsRepository.getPlatformSettings();
  const policy = getManagedHostingPolicy();

  let usage: Awaited<ReturnType<PostgresManagedHostingRepository["getCurrentMonthUsage"]>> | null = null;
  let monthOverride: ManagedHostingMonthOverride | null = null;
  let setupError: string | null = null;

  try {
    [usage, monthOverride] = await Promise.all([
      hostingRepository.getCurrentMonthUsage(),
      hostingRepository.getMonthOverride(),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const looksLikeMissingSchema =
      /media_watch_credits|media_ingest_jobs|managed_hosting/i.test(message) ||
      /does not exist|undefined table|relation/i.test(message);
    setupError = looksLikeMissingSchema
      ? "The hosting/usage database schema has not been installed yet. Run `npm run db:migrate` once against this deployment's PostgreSQL database, then reload this page."
      : "Hosting usage could not be loaded. Check the database connection and migration status in Settings & Integrations.";
  }

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
            Monthly measured/estimated usage and, when enabled for this deployment, the current managed-service amount.
          </p>
        </div>

        {usage ? (
          <ManagedHostingPanel
            policy={policy}
            monthStart={usage.monthStart}
            monthOverride={monthOverride}
            usage={{
              courseWatchMinutesMeasured: usage.courseWatchMinutesMeasured,
              liveAudienceMinutesEstimated: usage.liveAudienceMinutesEstimated,
              ociMediaFlowEstimatedCostUsd: usage.ociMediaFlowEstimatedCostUsd,
            }}
          />
        ) : (
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-5 text-amber-500" /> Hosting setup is not complete
              </CardTitle>
              <CardDescription>
                This page depends on the latest MkLMS database migrations. The rest of the portal can still run while this module is being configured.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">{setupError}</p>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Migration command</p>
                <code className="mt-2 block break-all text-sm">npm run db:migrate</code>
              </div>
              <p className="text-xs text-muted-foreground">
                Run migrations from a trusted machine or release job that has the same DATABASE_URL as this deployment. Do not add migrations to every Vercel/Cloudflare build.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
