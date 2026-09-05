import { AlertTriangle, CalendarClock, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateManagedHostingAmountDue,
  getBillingMonthKey,
  type ManagedHostingMonthOverride,
  type ManagedHostingPolicy,
} from "../domain/managed-hosting";
import type { ManagedHostingServiceAccess } from "../server/managed-hosting-access";
import { ManagedHostingPayButton } from "./managed-hosting-pay-button";

export interface ManagedHostingUsageClientSummary {
  courseWatchMinutesMeasured: number;
  liveAudienceMinutesEstimated: number;
}

export function ManagedHostingPanel({
  policy,
  usage,
  monthStart,
  monthOverride,
  billingAutomationEnabled = false,
  displayTitle = "Managed Video Hosting & Maintenance",
  displayDescription,
  serviceAccess,
}: {
  policy: ManagedHostingPolicy;
  usage: ManagedHostingUsageClientSummary;
  monthStart: Date;
  monthOverride?: ManagedHostingMonthOverride | null;
  billingAutomationEnabled?: boolean;
  displayTitle?: string;
  displayDescription?: string | null;
  serviceAccess?: ManagedHostingServiceAccess | null;
}) {
  const totalUsageMinutes = usage.courseWatchMinutesMeasured + usage.liveAudienceMinutesEstimated;
  const monthKey = getBillingMonthKey(monthStart);
  const currentBilling = calculateManagedHostingAmountDue({
    watchMinutes: totalUsageMinutes,
    policy,
    monthlyMinimumFloorUsd: monthOverride?.minimumFloorUsd,
  });

  if (!policy.enabled) return null;

  const hasOutstandingInvoice =
    serviceAccess?.monthKey &&
    serviceAccess.amountDueUsd != null &&
    ["DUE", "OVERDUE", "RESTRICTED"].includes(serviceAccess.status);
  const amountDueUsd = hasOutstandingInvoice
    ? serviceAccess.amountDueUsd ?? 0
    : currentBilling.amountDueUsd;
  const shownMonthKey = hasOutstandingInvoice ? serviceAccess?.monthKey ?? monthKey : monthKey;
  const status = hasOutstandingInvoice ? serviceAccess?.status ?? "DUE" : monthOverride?.paymentStatus === "PAID" ? "PAID" : monthOverride?.paymentStatus === "WAIVED" ? "WAIVED" : "CURRENT";
  const isWarning = status === "OVERDUE" || status === "RESTRICTED";

  return (
    <div className="space-y-6">
      <Card className={isWarning ? "border-amber-500/60" : "border-primary/40"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {isWarning ? <AlertTriangle className="size-5 text-amber-500" /> : <CalendarClock className="size-5" />}
            {displayTitle}
          </CardTitle>
          <CardDescription>
            {displayDescription || "Managed video hosting, protected delivery, live-video infrastructure and platform maintenance."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-5">
            <p className="text-xs text-muted-foreground">{hasOutstandingInvoice ? `Invoice · ${shownMonthKey}` : `Current billing month · ${shownMonthKey}`}</p>
            <p className="mt-1 text-sm font-medium">{hasOutstandingInvoice ? "Amount due" : "Current hosting balance"}</p>
            <p className="mt-1 text-3xl font-semibold">${amountDueUsd.toFixed(2)}</p>
            <p className="mt-1 text-xs font-medium">{status}</p>
          </div>

          {serviceAccess?.dueAt && hasOutstandingInvoice ? (
            <p className="text-sm text-muted-foreground">Payment due: {serviceAccess.dueAt.toLocaleDateString()}</p>
          ) : null}
          {status === "OVERDUE" ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              {serviceAccess?.warning || "Your managed hosting payment is overdue. Please pay before the grace period ends to avoid interruption of hosted video services."}
            </p>
          ) : null}
          {status === "RESTRICTED" ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              {serviceAccess?.warning || "Managed hosted-video services are restricted because the hosting payment remains overdue."} Payment confirmation automatically restores restricted hosting services. No course, student, or video records are deleted.
            </p>
          ) : null}
          {monthOverride?.operatorNote ? <p className="text-sm leading-6 text-muted-foreground">{monthOverride.operatorNote}</p> : null}
          {policy.notice ? <p className="text-sm leading-6 text-muted-foreground">{policy.notice}</p> : null}

          {status === "PAID" ? (
            <p className="text-sm font-medium">Payment received for this month.</p>
          ) : status === "WAIVED" ? (
            <p className="text-sm font-medium">Payment has been waived for this month.</p>
          ) : billingAutomationEnabled ? (
            <ManagedHostingPayButton />
          ) : policy.paymentUrl ? (
            <Button asChild>
              <a href={policy.paymentUrl} target="_blank" rel="noreferrer noopener">
                Pay now <ExternalLink className="ml-1.5 size-4" />
              </a>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Payment link has not been configured by the operator.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
