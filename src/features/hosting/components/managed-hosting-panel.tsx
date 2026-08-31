import { CalendarClock, CreditCard, ExternalLink, Gauge, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateManagedHostingFee,
  getBillingMonthKey,
  type ManagedHostingPolicy,
} from "../domain/managed-hosting";

export interface ManagedHostingUsageClientSummary {
  courseWatchMinutesMeasured: number;
  liveAudienceMinutesEstimated: number;
  ociMediaFlowEstimatedCostUsd: number;
}

export function ManagedHostingPanel({
  policy,
  usage,
  monthStart,
}: {
  policy: ManagedHostingPolicy;
  usage: ManagedHostingUsageClientSummary;
  monthStart: Date;
}) {
  const totalUsageMinutes = usage.courseWatchMinutesMeasured + usage.liveAudienceMinutesEstimated;
  const amountDue = calculateManagedHostingFee({ watchMinutes: totalUsageMinutes, policy });
  const monthKey = getBillingMonthKey(monthStart);
  const hasWallet = Boolean(policy.usdtTrc20Address || policy.usdtTonAddress);

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
              This month is calculated independently. A new calendar month automatically starts with fresh usage while prior provider bills remain separate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Amount due</p>
              <p className="mt-1 text-3xl font-semibold">${amountDue.toFixed(2)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Managed-service charge based on this month&apos;s measured/estimated usage. It is separate from Cloudflare/OCI/provider invoices.
              </p>
            </div>

            {policy.notice ? <p className="text-sm leading-6 text-muted-foreground">{policy.notice}</p> : null}

            {hasWallet ? (
              <div className="rounded-lg border p-4">
                <p className="flex items-center gap-2 text-sm font-medium"><WalletCards className="size-4" /> USDT payment options</p>
                <p className="mt-1 text-xs text-muted-foreground">Send only USDT on the exact network shown. Confirm the address before payment.</p>
                <div className="mt-3 space-y-3">
                  {policy.usdtTrc20Address ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">USDT · TRC20</p>
                      <code className="mt-1 block break-all rounded bg-muted px-3 py-2 text-xs">{policy.usdtTrc20Address}</code>
                    </div>
                  ) : null}
                  {policy.usdtTonAddress ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">USDT · TON</p>
                      <code className="mt-1 block break-all rounded bg-muted px-3 py-2 text-xs">{policy.usdtTonAddress}</code>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {policy.paymentUrl ? (
              <Button asChild>
                <a href={policy.paymentUrl} target="_blank" rel="noreferrer noopener">
                  Open payment page <ExternalLink className="ml-1.5 size-4" />
                </a>
              </Button>
            ) : !hasWallet ? (
              <p className="text-sm text-muted-foreground">Payment details are not currently configured.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
