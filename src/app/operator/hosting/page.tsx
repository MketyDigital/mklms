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
  displayTitle: "Managed Video Hosting & Maintenance",
  displayDescription: "Managed video hosting, protected delivery, live-video infrastructure and platform maintenance.",
  notice: "",
  overdueWarning: "Your managed video hosting and maintenance payment is overdue. Please pay to avoid interruption of hosted video services.",
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
      setMessage("Operator controls unlocked.");
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
      const response = await fetch(`/api/operator/hosting/month?monthKey=${encodeURIComponent(monthKey)}`, {
        cache: "no-store",
        headers: { "x-mklms-operator-key": operatorKey },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Could not load month.");
      setMonthFloor(Number(payload.month?.minimumFloorUsd ?? policy.minimumMonthlyFeeUsd));
      setMonthStatus(payload.month?.paymentStatus ?? "PENDING");
      setMonthNote(String(payload.month?.operatorNote ?? ""));
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

  if (!loaded) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Managed Hosting Operator</CardTitle>
            <CardDescription>This area is separate from tenant administration and requires the operator key.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="password" value={operatorKey} onChange={(event) => setOperatorKey(event.target.value)} placeholder="Managed-hosting operator key" autoComplete="off" />
            <Button onClick={() => void loadPolicy()} disabled={busy || !operatorKey}>{busy ? "Checking…" : "Unlock operator controls"}</Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Managed Hosting Policy</CardTitle>
          <CardDescription>These commercial controls are not shown to tenant admins. Existing accrual and usage calculation rules remain unchanged.</CardDescription>
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
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save hosting policy"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Override</CardTitle>
          <CardDescription>Set a specific monthly floor, note, or payment status. Usage can still produce a higher charge under the existing calculation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveMonth}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Month</span><Input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} /></label>
              <label className="space-y-1 text-sm"><span>Monthly minimum / floor (USD)</span><Input type="number" min="0" step="0.01" value={monthFloor} onChange={(event) => setMonthFloor(Number(event.target.value))} /></label>
            </div>
            <label className="block space-y-1 text-sm"><span>Payment status</span><select className="h-9 w-full rounded-md border bg-background px-3" value={monthStatus} onChange={(event) => setMonthStatus(event.target.value as typeof monthStatus)}><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="WAIVED">Waived</option></select></label>
            <label className="block space-y-1 text-sm"><span>Operator note</span><Input value={monthNote} onChange={(event) => setMonthNote(event.target.value)} /></label>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => void loadMonth()} disabled={busy}>Load month</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save month"}</Button></div>
          </form>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </main>
  );
}
