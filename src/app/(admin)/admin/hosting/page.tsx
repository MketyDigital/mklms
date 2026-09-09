import { AlertTriangle } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManagedHostingPanel } from "@/features/hosting/components/managed-hosting-panel";
import {
  calculateManagedHostingAmountDue,
  getBillingMonthKey,
  getStreamingActivityBand,
  type ManagedHostingMonthOverride,
} from "@/features/hosting/domain/managed-hosting";
import { PostgresManagedHostingLedgerRepository } from "@/features/hosting/repositories/postgres-managed-hosting-ledger.repository";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import { getManagedHostingServiceAccess } from "@/features/hosting/server/managed-hosting-access";
import {
  getEffectiveManagedHostingPolicy,
  isManagedHostingBillingAutomationConfigured,
} from "@/features/hosting/server/managed-hosting-policy";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminHostingPage() {
  const hostingRepository = new PostgresManagedHostingRepository();
  const ledgerRepository = new PostgresManagedHostingLedgerRepository();
  const settingsRepository = new PostgresSettingsRepository();
  const platformSettings = await settingsRepository.getPlatformSettings();
  const effective = await getEffectiveManagedHostingPolicy(hostingRepository);
  const billingAutomationEnabled = isManagedHostingBillingAutomationConfigured();

  let usage: Awaited<ReturnType<PostgresManagedHostingRepository["getCurrentMonthUsage"]>> | null = null;
  let monthOverride: ManagedHostingMonthOverride | null = null;
  let serviceAccess: Awaited<ReturnType<typeof getManagedHostingServiceAccess>> | null = null;
  let operatorAdjustmentUsd = 0;
  let setupError: string | null = null;

  try {
    usage = await hostingRepository.getCurrentMonthUsage();
    const monthKey = getBillingMonthKey(usage.monthStart);
    [monthOverride, serviceAccess, operatorAdjustmentUsd] = await Promise.all([
      hostingRepository.getMonthOverride(monthKey),
      getManagedHostingServiceAccess(hostingRepository),
      ledgerRepository.getMonthAdjustmentTotal(monthKey),
    ]);

    const usageSignals = {
      courseWatchMinutesMeasured: usage.courseWatchMinutesMeasured,
      liveAudienceMinutesEstimated: usage.liveAudienceMinutesEstimated,
    };
    const automatic = calculateManagedHostingAmountDue({
      watchMinutes: usage.courseWatchMinutesMeasured + usage.liveAudienceMinutesEstimated,
      usageSignals,
      policy: effective.policy,
      monthlyMinimumFloorUsd: monthOverride?.minimumFloorUsd,
      operatorAdjustmentUsd: 0,
    });
    await ledgerRepository.recordDailySnapshot({
      measuredWatchMinutes: usage.courseWatchMinutesMeasured,
      estimatedLiveAudienceMinutes: usage.liveAudienceMinutesEstimated,
      streamingActivityBand: getStreamingActivityBand(usageSignals),
      automaticBalanceUsd: automatic.amountDueUsd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const looksLikeMissingSchema =
      /media_watch_credits|managed_hosting/i.test(message) ||
      /does not exist|undefined table|relation/i.test(message);
    setupError = looksLikeMissingSchema
      ? "The hosting/usage database schema is not current. Run npm run db:migrate against this deployment database (or the MkLMS DB migrations GitHub Action), require verification to pass, then reload this page."
      : "Hosting billing could not be loaded. Check the database connection and migration status in Settings & Integrations.";
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
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Hosting & Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View your current managed video-hosting balance, streaming activity, payment status and payment notices.
          </p>
        </div>

        {usage ? (
          <ManagedHostingPanel
            policy={effective.policy}
            displayTitle={effective.displayTitle}
            displayDescription={effective.displayDescription}
            monthStart={usage.monthStart}
            monthOverride={monthOverride}
            operatorAdjustmentUsd={operatorAdjustmentUsd}
            serviceAccess={serviceAccess}
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
