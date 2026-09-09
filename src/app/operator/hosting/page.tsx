"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface PolicyForm {
  enabled: boolean;
  minimumMonthlyFeeUsd: number;
  maximumMonthlyFeeUsd: number;
  displayTitle: string;
  displayDescription: string;
  notice: string;
  overdueWarning: string;
  dueDaysAfterMonthEnd: number;
  graceDays: number;
  enforcementEnabled: boolean;
}

const defaults: PolicyForm = {
  enabled: true,
  minimumMonthlyFeeUsd: 15,
  maximumMonthlyFeeUsd: 50,
  displayTitle: "Managed Video Hosting & Streaming",
  displayDescription: "Managed video hosting, protected playback, streaming delivery and platform infrastructure.",
  notice: "",
  overdueWarning: "Your managed video hosting and streaming payment is overdue. Please pay to avoid interruption of hosted video services.",
  dueDaysAfterMonthEnd: 5,
  graceDays: 5,
  enforcementEnabled: true,
};

export default function OperatorHostingPage() {
  const [operatorKey, setOperatorKey] = useState("");
  const [policy, setPolicy] = useState<PolicyForm>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [monthFloor, setMonthFloor] = useState(15);
  const [monthStatus, setMonthStatus] = useState<"PENDING" | "PAID" | "WAIVED">("PENDING");
  const [monthNote, setMonthNote] = useState("");
  const [dailyAdjustment, setDailyAdjustment] = useState(0);
  const [dailyAdjustmentReason, setDailyAdjustmentReason] = useState("");
  const [monthAdjustmentTotal, setMonthAdjustmentTotal] = useState(0);

  async function loadPolicy() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/operator/hosting/policy", {
        cache: "no-store",
        headers: { "x-mklms-operator-key": operatorKey },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.policy) throw new Error(payload?.message ?? "Could not load operator policy.");
      setPolicy({
        enabled: Boolean(payload.policy.enabled),
        minimumMonthlyFeeUsd: Number(payload.policy.minimumMonthlyFeeUsd),
        maximumMonthlyFeeUsd: Number(payload.policy.maximumMonthlyFeeUsd),
        displayTitle: String(payload.policy.displayTitle ?? defaults.displayTitle),
        displayDescription: String(payload.policy.displayDescription ?? ""),
        notice: String(payload.policy.notice ?? ""),
        overdueWarning: String(payload.policy.overdueWarning ?? ""),
        dueDaysAfterMonthEnd: Number(payload.policy.dueDaysAfterMonthEnd ?? 5),
        graceDays: Number(payload.policy.graceDays ?? 5),
        enforcementEnabled: Boolean(payload.policy.enforcementEnabled),
      });
      setLoaded(true);
      setMessage("Mkety operator controls unlocked.");
    } catch (error) {
      setLoaded(false);
      setMessage(error instanceof Error ? error.message : "Could not load operator policy.");
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/operator/hosting/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mklms-operator-key": operatorKey },
        body: JSON.stringify(policy),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Could not save operator policy.");
      setMessage("Managed-hosting policy saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save operator policy.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMonth() {
    setBusy(true);
    setMessage(null);
    try {
      const [monthResponse, adjustmentResponse] = await Promise.all([
        fetch(`/api/operator/hosting/month?monthKey=${encodeURIComponent(monthKey)}`, {
          cache: "no-store",
          headers: { "x-mklms-operator-key": operatorKey },
        }),
        fetch(`/api/operator/hosting/adjustment?monthKey=${encodeURIComponent(monthKey)}`, {
          cache: "no-store",
          headers: { "x-mklms-operator-key": operatorKey },
        }),
      ]);
      const monthPayload = await monthResponse.json().catch(() => null);
      const adjustmentPayload = await adjustmentResponse.json().catch(() => null);
      if (!monthResponse.ok || !monthPayload?.ok) throw new Error(monthPayload?.message ?? "Could not load month.");
      if (!adjustmentResponse.ok || !adjustmentPayload?.ok) throw new Error(adjustmentPayload?.message ?? "Could not load adjustments.");
      setMonthFloor(Number(monthPayload.month?.minimumFloorUsd ?? policy.minimumMonthlyFeeUsd));
      setMonthStatus(monthPayload.month?.paymentStatus ?? "PENDING");
      setMonthNote(String(monthPayload.month?.operatorNote ?? ""));
      setMonthAdjustmentTotal(Number(adjustmentPayload.totalAdjustmentUsd ?? 0));
      setMessage(`Loaded ${monthKey}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load month.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMonth(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/operator/hosting/month", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mklms-operator-key": operatorKey },
        body: JSON.stringify({
          monthKey,
          minimumFloorUsd: monthFloor,
          paymentStatus: monthStatus,
          operatorNote: monthNote,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Could not save month.");
      setMessage(`Monthly billing saved for ${monthKey}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save month.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDailyAdjustment(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/operator/hosting/adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mklms-operator-key": operatorKey },
        body: JSON.stringify({ amountUsd: dailyAdjustment, reason: dailyAdjustmentReason }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Could not save today's adjustment.");
      setDailyAdjustmentReason("");
      setMessage("Today's billing adjustment saved. Automatic streaming accrual continues normally from the resulting balance.");
      await loadMonth();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save today's adjustment.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <main className="mx-auto w-full max-w-xl px-3 py-6 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Managed Hosting Operator</CardTitle>
            <CardDescription>
              Commercial pricing controls are available only from the trusted Mkety production installation and require the separate operator key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="password" value={operatorKey} onChange={(event) => setOperatorKey(event.target.value)} placeholder="Managed-hosting operator key" autoComplete="off" />
            <Button className="w-full sm:w-auto" onClick={() => void loadPolicy()} disabled={busy || !operatorKey}>{busy ? "Checking…" : "Unlock operator controls"}</Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-3 py-6 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Managed Hosting Policy</CardTitle>
          <CardDescription>
            Private Mkety commercial controls. Tenant admins only see their hosting balance, streaming activity, billing period and payment state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={savePolicy}>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })} /> Managed hosting enabled</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Monthly minimum (USD)</span><Input type="number" min="0" step="0.01" value={policy.minimumMonthlyFeeUsd} onChange={(event) => setPolicy({ ...policy, minimumMonthlyFeeUsd: Number(event.target.value) })} /></label>
              <label className="space-y-1 text-sm"><span>Monthly maximum (USD)</span><Input type="number" min="0" step="0.01" value={policy.maximumMonthlyFeeUsd} onChange={(event) => setPolicy({ ...policy, maximumMonthlyFeeUsd: Number(event.target.value) })} /></label>
            </div>
            <label className="block space-y-1 text-sm"><span>Tenant billing title</span><Input value={policy.displayTitle} onChange={(event) => setPolicy({ ...policy, displayTitle: event.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>Description</span><textarea className="min-h-20 w-full rounded-md border bg-background p-3" value={policy.displayDescription} onChange={(event) => setPolicy({ ...policy, displayDescription: event.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>General billing notice</span><textarea className="min-h-20 w-full rounded-md border bg-background p-3" value={policy.notice} onChange={(event) => setPolicy({ ...policy, notice: event.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>Overdue warning</span><textarea className="min-h-20 w-full rounded-md border bg-background p-3" value={policy.overdueWarning} onChange={(event) => setPolicy({ ...policy, overdueWarning: event.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Payment due days after month end</span><Input type="number" min="0" max="31" value={policy.dueDaysAfterMonthEnd} onChange={(event) => setPolicy({ ...policy, dueDaysAfterMonthEnd: Number(event.target.value) })} /></label>
              <label className="space-y-1 text-sm"><span>Grace period (days)</span><Input type="number" min="0" max="31" value={policy.graceDays} onChange={(event) => setPolicy({ ...policy, graceDays: Number(event.target.value) })} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enforcementEnabled} onChange={(event) => setPolicy({ ...policy, enforcementEnabled: event.target.checked })} /> Restrict hosted paid-video services after grace period</label>
            <Button className="w-full sm:w-auto" type="submit" disabled={busy}>{busy ? "Saving…" : "Save hosting policy"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's Adjustment</CardTitle>
          <CardDescription>
            Increase or correct today's hosting balance once. The automatic usage-sensitive calculation continues normally on following days; this adjustment is stored in the audit ledger and is not repeated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveDailyAdjustment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Today's adjustment (USD)</span><Input type="number" step="0.01" value={dailyAdjustment} onChange={(event) => setDailyAdjustment(Number(event.target.value))} /></label>
              <div className="rounded-md border bg-muted/30 p-3 text-sm"><p className="text-xs text-muted-foreground">Adjustments this month</p><p className="mt-1 text-xl font-semibold">${monthAdjustmentTotal.toFixed(2)}</p></div>
            </div>
            <label className="block space-y-1 text-sm"><span>Reason</span><Input required minLength={3} value={dailyAdjustmentReason} onChange={(event) => setDailyAdjustmentReason(event.target.value)} placeholder="Reason for today's adjustment" /></label>
            <Button className="w-full sm:w-auto" type="submit" disabled={busy || !dailyAdjustmentReason.trim()}>{busy ? "Saving…" : "Apply today's adjustment"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Override</CardTitle>
          <CardDescription>Set a specific monthly floor, internal note, or payment status. Streaming usage can still produce a higher charge.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveMonth}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Month</span><Input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} /></label>
              <label className="space-y-1 text-sm"><span>Monthly minimum / floor (USD)</span><Input type="number" min="0" step="0.01" value={monthFloor} onChange={(event) => setMonthFloor(Number(event.target.value))} /></label>
            </div>
            <label className="block space-y-1 text-sm"><span>Payment status</span><select className="h-9 w-full rounded-md border bg-background px-3" value={monthStatus} onChange={(event) => setMonthStatus(event.target.value as typeof monthStatus)}><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="WAIVED">Waived</option></select></label>
            <label className="block space-y-1 text-sm"><span>Internal operator note</span><Input value={monthNote} onChange={(event) => setMonthNote(event.target.value)} /></label>
            <div className="grid gap-2 sm:flex"><Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => void loadMonth()} disabled={busy}>Load month</Button><Button className="w-full sm:w-auto" type="submit" disabled={busy}>{busy ? "Saving…" : "Save month"}</Button></div>
          </form>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </main>
  );
}
