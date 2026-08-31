import { AlertTriangle } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManagedHostingPanel } from "@/features/hosting/components/managed-hosting-panel";
import type { ManagedHostingMonthOverride } from "@/features/hosting/domain/managed-hosting";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import {
  getManagedHostingPolicy,
  isManagedHostingBillingAutomationConfigured,
} from "@/features/hosting/server/managed-hosting-policy";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminHostingPage() {
  const hostingRepository = new PostgresManagedHostingRepository();
  const settingsRepository = new PostgresSettingsRepository();
  const platformSettings = await settingsRepository.getPlatformSettings();
  const policy = getManagedHostingPolicy();
  const billingAutomationEnabled = isManagedHostingBillingAutomationConfigured();

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
      /media_watch_credits|managed_hosting/i.test(message) ||
      /does not exist|undefined table|relation/i.test(message);
    setupError = looksLikeMissingSchema
      ? "The hosting/usage database schema is not current. Run npm run db:migrate against this deployment database (or the MkLMS DB migrations GitHub Action), require verification to pass, then reload this page."
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
            Monthly course/live usage and, when enabled for this deployment, the current managed-hosting amount and payment status.
          </p>
        </div>

        {usage ? (
          <ManagedHostingPanel
            policy={policy}
            monthStart={usage.monthStart}
            monthOverride={monthOverride}
            billingAutomationEnabled={billingAutomationEnabled}
            usage={{
              courseWatchMinutesMeasured: usage.courseWatchMinutesMeasured,
              liveAudienceMinutesEstimated: usage.liveAudienceMinutesEstimated,
            }}
          />
        ) : (
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-5 text-amber-500" /> Hosting setup is not complete
              </CardTitle>
              <CardDescription>
                This page depends on the current MkLMS database migrations and managed-hosting configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{setupError}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
