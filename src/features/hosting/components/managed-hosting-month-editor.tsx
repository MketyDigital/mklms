"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ManagedHostingMonthEditor({
  monthKey,
  currentFloorUsd,
  currentStatus,
  currentNote,
}: {
  monthKey: string;
  currentFloorUsd: number;
  currentStatus: "PENDING" | "PAID" | "WAIVED";
  currentNote?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/hosting/month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey,
          minimumFloorUsd: Number(formData.get("minimumFloorUsd") ?? currentFloorUsd),
          operatorNote: String(formData.get("operatorNote") ?? ""),
          paymentStatus: String(formData.get("paymentStatus") ?? currentStatus),
          operatorKey: String(formData.get("operatorKey") ?? ""),
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message ?? "Could not update this month's bill.");
      setMessage("Monthly billing floor updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this month's bill.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Operator controls · {monthKey}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The monthly floor is the least this deployment owes. If usage calculates a higher amount, the higher usage amount wins. Updating this requires the separate managed-hosting operator key.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Monthly minimum / floor (USD)</span>
          <Input name="minimumFloorUsd" type="number" min="0" step="0.01" defaultValue={currentFloorUsd} required />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Payment status</span>
          <select name="paymentStatus" defaultValue={currentStatus} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="WAIVED">Waived</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Operator note</span>
        <Input name="operatorNote" defaultValue={currentNote ?? ""} placeholder="Optional note for this month" />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Managed-hosting operator key</span>
        <Input name="operatorKey" type="password" autoComplete="off" required placeholder="Required to change billing" />
      </label>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save monthly billing"}</Button>
    </form>
  );
}
