import { CalendarClock, CreditCard, ExternalLink, Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateManagedHostingAmountDue,
  getBillingMonthKey,
  type ManagedHostingMonthOverride,
  type ManagedHostingPolicy,
} from "../domain/managed-hosting";
import { ManagedHostingMonthEditor } from "./managed-hosting-month-editor";

export interface ManagedHostingUsageClientSummary {
  courseWatchMinutesMeasured: number;
  liveAudienceMinutesEstimated: number;
  ociMediaFlowEstimatedCostUsd: number;
}

export function ManagedHostingPanel({
  policy,
  usage,
  monthStart,
  monthOverride,
}: {
  policy: ManagedHostingPolicy;
  usage: ManagedHostingUsageClientSummary;
  monthStart: Date;
  monthOverride?: ManagedHostingMonthOverride | null;
}) {
  const totalUsageMinutes = usage.courseWatchMinutesMeasured + usage.liveAudienceMinutesEstimated;
  const monthKey = getBillingMonthKey(monthStart);
  const billing = calculateManagedHostingAmountDue({
    watchMinutes: totalUsageMinutes,
    policy,
    monthlyMinimumFloorUsd: monthOverride?.minimumFloorUsd,
  });
  const paymentStatus = monthOverride?.paymentStatus ?? "PENDING";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Gauge className="size-4" /> Course watch</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{usage.courseWatchMinutesMeasured.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">minutes · MEASURED from trusted playback evidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Gauge className="size-4" /> Live audience</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{usage.liveAudienceMinutesEstimated.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">audience-minutes · ESTIMATED when baseline viewer mode is used</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><CreditCard className="size-4" /> Media processing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">${usage.ociMediaFlowEstimatedCostUsd.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">accepted OCI estimates this month · not an OCI invoice</p>
          </CardContent>
        </Card>
      </div>

      {policy.enabled ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-5" /> Managed hosting · {monthKey}
            </CardTitle>
            <CardDescription>
              The monthly operator floor is the minimum due. If usage calculates a higher managed-service charge, the higher amount is due instead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Monthly floor</p>
                <p className="mt-1 text-2xl font-semibold">${billing.minimumFloorUsd.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Usage-derived amount</p>
                <p className="mt-1 text-2xl font-semibold">${billing.usageDerivedFeeUsd.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground">Amount due</p>
                <p className="mt-1 text-2xl font-semibold">${billing.amountDueUsd.toFixed(2)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{paymentStatus}</p>
              </div>
            </div>

            {monthOverride?.operatorNote ? <p className="text-sm leading-6 text-muted-foreground">{monthOverride.operatorNote}</p> : null}
            {policy.notice ? <p className="text-sm leading-6 text-muted-foreground">{policy.notice}</p> : null}

            {policy.paymentUrl ? (
              <Button asChild>
                <a href={policy.paymentUrl} target="_blank" rel="noreferrer noopener">
                  Pay now <ExternalLink className="ml-1.5 size-4" />
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Payment link has not been configured by the operator.</p>
            )}

            <ManagedHostingMonthEditor
              monthKey={monthKey}
              currentFloorUsd={billing.minimumFloorUsd}
              currentStatus={paymentStatus}
              currentNote={monthOverride?.operatorNote}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
