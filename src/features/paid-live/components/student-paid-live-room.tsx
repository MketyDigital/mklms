"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaidLiveState } from "../domain/model";

interface PaidLiveRoomSession {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  state: PaidLiveState;
}

export function StudentPaidLiveRoom({ session }: { session: PaidLiveRoomSession }) {
  const [state, setState] = useState<PaidLiveState>(session.state);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authorize = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/courses/${session.courseId}/paid-live/${session.id}/playback`, { method: "POST", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        if (payload?.state === "UPCOMING" || payload?.state === "ENDED") setState(payload.state);
        setPlaybackUrl(null);
        setMessage(payload?.message ?? "Paid live playback is not available.");
        return;
      }
      setState("LIVE");
      setPlaybackUrl(payload.authorization.url);
      setMessage(null);
    } catch {
      setMessage("Could not refresh paid live playback.");
    } finally {
      setBusy(false);
    }
  }, [session.courseId, session.id]);

  useEffect(() => {
    if (state !== "LIVE") return;
    void authorize();
    const interval = window.setInterval(() => void authorize(), 240_000);
    return () => window.clearInterval(interval);
  }, [authorize, state]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle>{session.title}</CardTitle><Badge variant="outline">{state}</Badge></div>
        <CardDescription>{session.description || `${new Date(session.startsAt).toLocaleString()} — ${new Date(session.endsAt).toLocaleString()}`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "LIVE" && playbackUrl ? (
          <video key={playbackUrl} className="aspect-video w-full rounded-lg bg-black" src={playbackUrl} controls playsInline autoPlay />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {state === "UPCOMING" ? `This paid course live session starts ${new Date(session.startsAt).toLocaleString()}.` : state === "ENDED" ? "This paid course live session has ended." : message ?? "Preparing protected playback…"}
          </div>
        )}
        {message && state === "LIVE" ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {state === "LIVE" && !playbackUrl ? <Button disabled={busy} onClick={() => void authorize()}>{busy ? "Loading…" : "Retry playback"}</Button> : null}
      </CardContent>
    </Card>
  );
}
