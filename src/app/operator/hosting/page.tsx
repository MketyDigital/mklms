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
  const [installationId, setInstallationId] = useState("spf-mklms");
  const [policy, setPolicy] = useState<PolicyForm>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [monthFloor, setMonthFloor] = useState(15);
  const [monthStatus, setMonthStatus] = useState<"PENDING" | "PAID" | "WAIVED">("PENDING");
  const [monthNote, setMonthNote] = useState("");
  const [monthAdjustmentTotal, setMonthAdjustmentTotal] = useState(0);
  const [dailyAdjustment, setDailyAdjustment] = useState(0);
  const [dailyAdjustmentReason, setDailyAdjustmentReason] = useState("");
  const [paymentId, setPaymentId] = useState("");

  async function command(body: Record<string, unknown>) {
    const response = await fetch("/api/operator/hosting/customer", {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-mklms-operator-key": operatorKey,
      },
      body: JSON.stringify({ installationId, ...body }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message ?? "Billing command failed.");
    }
    return payload.result ?? payload;
  }

  async function unlock() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await command({ action: "getPolicy" });
      const p = result.policy;
      if (!p) throw new Error("Customer billing policy was not returned.");
      setPolicy({
        enabled: Boolean(p.enabled),
        minimumMonthlyFeeUsd: Number(p.minimumMonthlyFeeUsd),
        maximumMonthlyFeeUsd: Number(p.maximumMonthlyFeeUsd),
        displayTitle: String(p.displayTitle ?? defaults.displayTitle),
        displayDescription: String(p.displayDescription ?? ""),
        notice: String(p.notice ?? ""),
        overdueWarning: String(p.overdueWarning ?? ""),
        dueDaysAfterMonthEnd: Number(p.dueDaysAfterMonthEnd ?? 5),
        graceDays: Number(p.graceDays ?? 5),
        enforcementEnabled: Boolean(p.enforcementEnabled),
      });
      setLoaded(true);
      setMessage("Connected to " + installationId + " billing controls.");
    } catch (error) {
      setLoaded(false);
      setMessage(error instanceof Error ? error.message : "Could not unlock customer billing.");
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await command({ action: "setPolicy", ...policy });
      setMessage("Billing policy saved for " + installationId + ".");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save policy.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMonth() {
    setBusy(true);
    setMessage(null);
    try {
      const [monthResult, adjustmentResult] = await Promise.all([
        command({ action: "getMonth", monthKey }),
        command({ action: "getAdjustments", monthKey }),
      ]);
      setMonthFloor(Number(monthResult.month?.minimumFloorUsd ?? policy.minimumMonthlyFeeUsd));
      setMonthStatus(monthResult.month?.paymentStatus ?? "PENDING");
      setMonthNote(String(monthResult.month?.operatorNote ?? ""));
      setMonthAdjustmentTotal(Number(adjustmentResult.totalAdjustmentUsd ?? 0));
      setMessage("Loaded " + installationId + " · " + monthKey + ".");
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
      await command({
        action: "setMonth",
        monthKey,
        minimumFloorUsd: monthFloor,
        paymentStatus: monthStatus,
        operatorNote: monthNote,
      });
      setMessage("Saved " + installationId + " · " + monthKey + " as " + monthStatus + ".");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save month.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAdjustment(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await command({ action: "addAdjustment", amountUsd: dailyAdjustment, reason: dailyAdjustmentReason });
      setDailyAdjustmentReason("");
      setMessage("Today's adjustment saved for " + installationId + ".");
      await loadMonth();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save adjustment.");
    } finally {
      setBusy(false);
    }
  }

  async function reconcilePayment(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await command({ action: "reconcilePayment", monthKey, paymentId });
      if (!result.reconciled) throw new Error("Payment was not reconciled.");
      setMessage("NOWPayments payment " + paymentId + " verified as finished and applied.");
      await loadMonth();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reconcile payment.");
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
              Central Mkety owner controls. Customer databases remain isolated behind signed billing-service commands.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span>Billing installation ID</span>
              <Input value={installationId} onChange={(event) => setInstallationId(event.target.value.trim())} placeholder="spf-mklms" />
            </label>
            <Input type="password" value={operatorKey} onChange={(event) => setOperatorKey(event.target.value)} placeholder="Managed-hosting operator key" autoComplete="off" />
            <Button className="w-full sm:w-auto" onClick={() => void unlock()} disabled={busy || !operatorKey || !installationId}>
              {busy ? "Checking…" : "Unlock customer billing"}
            </Button>
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
          <CardTitle>{installationId}</CardTitle>
          <CardDescription>Central platform-owner billing control for the selected managed installation.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>Managed Hosting Policy</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={savePolicy}>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enabled} onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })} /> Managed hosting enabled</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Monthly minimum (USD)</span><Input type="number" min="0" step="0.01" value={policy.minimumMonthlyFeeUsd} onChange={(e) => setPolicy({ ...policy, minimumMonthlyFeeUsd: Number(e.target.value) })} /></label>
              <label className="space-y-1 text-sm"><span>Monthly maximum (USD)</span><Input type="number" min="0" step="0.01" value={policy.maximumMonthlyFeeUsd} onChange={(e) => setPolicy({ ...policy, maximumMonthlyFeeUsd: Number(e.target.value) })} /></label>
            </div>
            <label className="block space-y-1 text-sm"><span>Tenant billing title</span><Input value={policy.displayTitle} onChange={(e) => setPolicy({ ...policy, displayTitle: e.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>Description</span><textarea className="min-h-20 w-full rounded-md border bg-background p-3" value={policy.displayDescription} onChange={(e) => setPolicy({ ...policy, displayDescription: e.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>General billing notice</span><textarea className="min-h-20 w-full rounded-md border bg-background p-3" value={policy.notice} onChange={(e) => setPolicy({ ...policy, notice: e.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>Overdue warning</span><textarea className="min-h-20 w-full rounded-md border bg-background p-3" value={policy.overdueWarning} onChange={(e) => setPolicy({ ...policy, overdueWarning: e.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Due days after month end</span><Input type="number" min="0" max="31" value={policy.dueDaysAfterMonthEnd} onChange={(e) => setPolicy({ ...policy, dueDaysAfterMonthEnd: Number(e.target.value) })} /></label>
              <label className="space-y-1 text-sm"><span>Grace period (days)</span><Input type="number" min="0" max="31" value={policy.graceDays} onChange={(e) => setPolicy({ ...policy, graceDays: Number(e.target.value) })} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enforcementEnabled} onChange={(e) => setPolicy({ ...policy, enforcementEnabled: e.target.checked })} /> Enforce after grace period</label>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save customer policy"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Monthly Billing</CardTitle><CardDescription>Load and control a customer billing month.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveMonth}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Month</span><Input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span>Monthly floor (USD)</span><Input type="number" min="0" step="0.01" value={monthFloor} onChange={(e) => setMonthFloor(Number(e.target.value))} /></label>
            </div>
            <label className="block space-y-1 text-sm"><span>Payment status</span><select className="h-9 w-full rounded-md border bg-background px-3" value={monthStatus} onChange={(e) => setMonthStatus(e.target.value as typeof monthStatus)}><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="WAIVED">Waived</option></select></label>
            <label className="block space-y-1 text-sm"><span>Internal operator note</span><Input value={monthNote} onChange={(e) => setMonthNote(e.target.value)} /></label>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void loadMonth()} disabled={busy}>Load month</Button><Button type="submit" disabled={busy}>Save month</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>NOWPayments Reconciliation</CardTitle><CardDescription>Verifies directly with NOWPayments. Only a finished payment belonging to this installation and month is applied.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={reconcilePayment}>
            <label className="block space-y-1 text-sm"><span>NOWPayments payment ID</span><Input required value={paymentId} onChange={(e) => setPaymentId(e.target.value.trim())} /></label>
            <Button type="submit" disabled={busy || !paymentId}>{busy ? "Verifying…" : "Verify and reconcile"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Today's Adjustment</CardTitle><CardDescription>Current month adjustment total: \${monthAdjustmentTotal.toFixed(2)}</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveAdjustment}>
            <Input type="number" step="0.01" value={dailyAdjustment} onChange={(e) => setDailyAdjustment(Number(e.target.value))} />
            <Input required minLength={3} value={dailyAdjustmentReason} onChange={(e) => setDailyAdjustmentReason(e.target.value)} placeholder="Reason" />
            <Button type="submit" disabled={busy || !dailyAdjustmentReason.trim()}>Apply adjustment</Button>
          </form>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </main>
  );
}
