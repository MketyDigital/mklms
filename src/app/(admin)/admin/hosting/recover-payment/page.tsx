"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function HostingPaymentRecoveryPage() {
  const [monthKey, setMonthKey] = useState("2026-09");
  const [paymentId, setPaymentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/managed-hosting/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ monthKey, paymentId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Could not verify payment.");
      setMessage("Payment verified with NOWPayments and recorded as paid.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-3 py-6 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Recover completed hosting payment</CardTitle>
          <CardDescription>
            Use this when NOWPayments received the payment but Hosting & Billing still shows the invoice as pending.
            The provider is checked directly and only a finished payment belonging to this installation and month can be applied.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-1 text-sm">
              <span>Billing month</span>
              <Input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} required />
            </label>
            <label className="block space-y-1 text-sm">
              <span>NOWPayments payment ID</span>
              <Input value={paymentId} onChange={(event) => setPaymentId(event.target.value.trim())} required />
            </label>
            <Button type="submit" disabled={busy || !paymentId}>{busy ? "Verifying…" : "Verify and mark paid"}</Button>
          </form>
          {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
          <Link href="/admin/hosting" className="mt-4 inline-block text-sm underline">Back to Hosting & Billing</Link>
        </CardContent>
      </Card>
    </main>
  );
}
