"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ManagedHostingPayButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/managed-hosting/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        invoiceUrl?: string;
        message?: string;
      } | null;
      if (!response.ok || !payload?.invoiceUrl) {
        throw new Error(payload?.message ?? "Could not start payment.");
      }
      window.location.assign(payload.invoiceUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start payment.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={startCheckout} disabled={busy}>
        <CreditCard className="mr-1.5 size-4" />
        {busy ? "Preparing payment…" : "Pay now"}
      </Button>
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
