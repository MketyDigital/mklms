"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ManagedHostingReconcilePayment({ monthKey }: { monthKey: string }) {
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
      setMessage("Payment verified with NOWPayments and recorded as paid. Reloading…");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="rounded-md border bg-muted/20 p-3" onSubmit={submit}>
      <p className="text-sm font-medium">Already paid but still showing pending?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Enter the NOWPayments payment ID. The payment is verified directly with NOWPayments and must belong to this month before it can be marked paid.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={paymentId} onChange={(event) => setPaymentId(event.target.value.trim())} placeholder="NOWPayments payment ID" required />
        <Button type="submit" variant="outline" disabled={busy || !paymentId}>
          {busy ? "Verifying…" : "Verify payment"}
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
