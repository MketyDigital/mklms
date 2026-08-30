"use client";

import { useState } from "react";
import { CreditCard, Gauge, Save, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateManagedHostingFee, type ManagedHostingSettings } from "../domain/managed-hosting";

export interface ManagedHostingUsageClientSummary {
  courseWatchMinutesMeasured: number;
  liveAudienceMinutesEstimated: number;
  ociMediaFlowEstimatedCostUsd: number;
}

export function ManagedHostingPanel({
  initialSettings,
  usage,
}: {
  initialSettings: ManagedHostingSettings;
  usage: ManagedHostingUsageClientSummary;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalUsageMinutes = usage.courseWatchMinutesMeasured + usage.liveAudienceMinutesEstimated;
  const suggestedFee = calculateManagedHostingFee({ watchMinutes: totalUsageMinutes, settings });

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/hosting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; settings?: ManagedHostingSettings };
      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.message ?? "Could not save managed-hosting settings.");
      }
      setSettings(payload.settings);
      setMessage("Managed-hosting settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save managed-hosting settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Gauge className="size-4" /> Course watch</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{usage.courseWatchMinutesMeasured.toLocaleString()}</p><p className="text-xs text-muted-foreground">minutes · MEASURED from trusted playback grants</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Gauge className="size-4" /> Live audience</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{usage.liveAudienceMinutesEstimated.toLocaleString()}</p><p className="text-xs text-muted-foreground">audience-minutes · ESTIMATED when baseline viewer mode is used</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CreditCard className="size-4" /> OCI transcode estimate</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">${usage.ociMediaFlowEstimatedCostUsd.toFixed(2)}</p><p className="text-xs text-muted-foreground">accepted Media Flow estimates this month; not an OCI invoice</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Managed hosting charge</CardTitle>
          <CardDescription>
            This is your service/management fee for installations you operate on a customer&apos;s behalf. It is deliberately separate from actual Cloudflare/OCI/provider costs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />
            Enable managed-hosting payment details for this deployment
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Minimum monthly fee (USD/USDT)</span><Input type="number" min="0" step="0.01" value={settings.minimumMonthlyFeeUsd} onChange={(event) => setSettings({ ...settings, minimumMonthlyFeeUsd: Number(event.target.value) })} /></label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Maximum monthly fee (USD/USDT)</span><Input type="number" min="0" step="0.01" value={settings.maximumMonthlyFeeUsd} onChange={(event) => setSettings({ ...settings, maximumMonthlyFeeUsd: Number(event.target.value) })} /></label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Amount to request this month</span><Input type="number" min={settings.minimumMonthlyFeeUsd} max={settings.maximumMonthlyFeeUsd} step="0.01" value={settings.currentMonthlyFeeUsd} onChange={(event) => setSettings({ ...settings, currentMonthlyFeeUsd: Number(event.target.value) })} /></label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">USDT network</span><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={settings.paymentNetwork} onChange={(event) => setSettings({ ...settings, paymentNetwork: event.target.value as ManagedHostingSettings["paymentNetwork"] })}><option value="TRC20">USDT TRC20</option><option value="TON">USDT TON</option><option value="CUSTOM">Custom</option></select></label>
          <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Wallet address / payment details</span><Input value={settings.walletAddress} onChange={(event) => setSettings({ ...settings, walletAddress: event.target.value })} placeholder="Wallet address" /></label>
          <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Payment note</span><textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" value={settings.paymentNote ?? ""} onChange={(event) => setSettings({ ...settings, paymentNote: event.target.value })} placeholder="Monthly managed hosting/support fee. Infrastructure provider invoices remain separate." /></label>

          <div className="rounded-lg border bg-muted/20 p-4 md:col-span-2">
            <div className="flex items-start gap-3"><Wallet className="mt-0.5 size-5" /><div><p className="font-medium">Suggested service fee from current usage tier: ${suggestedFee.toFixed(2)}</p><p className="mt-1 text-xs text-muted-foreground">The suggestion uses the configured $15-$50-style range and measured/estimated usage above. Admin remains in control of the actual amount requested.</p></div></div>
          </div>
          {message ? <div className="rounded-lg border px-3 py-2 text-sm md:col-span-2">{message}</div> : null}
          <div className="md:col-span-2"><Button type="button" onClick={() => void save()} disabled={busy}><Save className="mr-1.5 size-4" /> Save hosting settings</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
