"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ViewerDisplayMode } from "../domain/live-session";
import type { AttendeeChatVisibility } from "../services/live-room.service";

interface BatchVisibilityOption {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  expectedViewerBaseline: number;
  viewerDisplayMode: ViewerDisplayMode;
  attendeeChatVisibility: AttendeeChatVisibility;
  endedMessage?: string | null;
  endedRedirectUrl?: string | null;
  notificationDestination?: string | null;
}

export function AdminLiveChatVisibilityControl({ batches }: { batches: BatchVisibilityOption[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function updateVisibility(batch: BatchVisibilityOption, attendeeChatVisibility: AttendeeChatVisibility) {
    setBusyId(batch.id);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/live-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateBatch",
          batchId: batch.id,
          title: batch.title,
          slug: batch.slug,
          description: batch.description ?? null,
          expectedViewerBaseline: batch.expectedViewerBaseline,
          viewerDisplayMode: batch.viewerDisplayMode,
          attendeeChatVisibility,
          endedMessage: batch.endedMessage ?? null,
          endedRedirectUrl: batch.endedRedirectUrl ?? null,
          notificationDestination: batch.notificationDestination ?? null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Could not update viewer comment visibility.");
      setMessage(attendeeChatVisibility === "PUBLIC" ? "Real viewer comments are now visible to everyone in this free live class." : "Real viewer comments are now visible only to the sender and admin.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update viewer comment visibility.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Real viewer comment visibility</CardTitle>
        <CardDescription>Free live only. Owner/Admin only preserves the existing behavior. Visible to everyone mixes real attendee comments into the same live chat without changing uploaded chat timing or playback.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <div className="rounded-lg border bg-muted/30 p-3 text-sm">{message}</div> : null}
        {batches.map((batch) => (
          <div key={batch.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{batch.title}</p><Badge variant="outline">{batch.status}</Badge></div>
              <p className="mt-1 text-xs text-muted-foreground">/{batch.slug}</p>
            </div>
            <div className="w-full space-y-1 sm:w-64">
              <Label htmlFor={`chat-visibility-${batch.id}`}>Viewer comments</Label>
              <select
                id={`chat-visibility-${batch.id}`}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={batch.attendeeChatVisibility}
                disabled={busyId === batch.id}
                onChange={(event) => void updateVisibility(batch, event.target.value as AttendeeChatVisibility)}
              >
                <option value="OWNER_ONLY">Owner/Admin only</option>
                <option value="PUBLIC">Visible to everyone</option>
              </select>
            </div>
          </div>
        ))}
        {!batches.length ? <p className="text-sm text-muted-foreground">Create a free live class first.</p> : null}
        {busyId ? <Button size="sm" variant="outline" disabled>Saving…</Button> : null}
      </CardContent>
    </Card>
  );
}
