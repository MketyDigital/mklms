"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaidLiveDeliveryMode, PaidLiveState } from "../domain/model";

interface PaidLiveRoomSession {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  state: PaidLiveState;
  deliveryMode: PaidLiveDeliveryMode;
}

export function StudentPaidLiveRoom({ session }: { session: PaidLiveRoomSession }) {
  const [state, setState] = useState<PaidLiveState>(session.state);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authorize = useCallback(async () => {
    if (session.deliveryMode !== "MEDIA") return;
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
  }, [session.courseId, session.deliveryMode, session.id]);

  const joinZoom = useCallback(async () => {
    if (session.deliveryMode !== "ZOOM") return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/courses/${session.courseId}/paid-live/${session.id}/join`, { method: "POST", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || typeof payload.joinUrl !== "string") {
        if (payload?.state === "UPCOMING" || payload?.state === "ENDED") setState(payload.state);
        setMessage(payload?.message ?? "The Zoom live class is not available.");
        return;
      }
      window.location.assign(payload.joinUrl);
    } catch {
      setMessage("Could not open the Zoom live class.");
    } finally {
      setBusy(false);
    }
  }, [session.courseId, session.deliveryMode, session.id]);

  useEffect(() => {
    if (session.deliveryMode !== "MEDIA" || state !== "LIVE") return;
    const initialAuthorization = window.setTimeout(() => void authorize(), 0);
    const interval = window.setInterval(() => void authorize(), 240_000);
    return () => {
      window.clearTimeout(initialAuthorization);
      window.clearInterval(interval);
    };
  }, [authorize, session.deliveryMode, state]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle>{session.title}</CardTitle><Badge variant="outline">{state}</Badge><Badge variant="secondary">{session.deliveryMode === "ZOOM" ? "Zoom" : "Video"}</Badge></div>
        <CardDescription>{session.description || `${new Date(session.startsAt).toLocaleString()} — ${new Date(session.endsAt).toLocaleString()}`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {session.deliveryMode === "ZOOM" ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-lg border bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {state === "UPCOMING"
                ? `This paid Zoom class starts ${new Date(session.startsAt).toLocaleString()}.`
                : state === "ENDED"
                  ? "This paid Zoom class has ended."
                  : "The paid Zoom class is live now."}
            </p>
            {state === "LIVE" ? <Button disabled={busy} onClick={() => void joinZoom()}>{busy ? "Opening Zoom…" : "Join live class on Zoom"}</Button> : null}
          </div>
        ) : state === "LIVE" && playbackUrl ? (
          <video key={playbackUrl} className="aspect-video w-full rounded-lg bg-black" src={playbackUrl} controls playsInline autoPlay />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {state === "UPCOMING" ? `This paid course live session starts ${new Date(session.startsAt).toLocaleString()}.` : state === "ENDED" ? "This paid course live session has ended." : message ?? "Preparing protected playback…"}
          </div>
        )}
        {message && state === "LIVE" ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {session.deliveryMode === "MEDIA" && state === "LIVE" && !playbackUrl ? <Button disabled={busy} onClick={() => void authorize()}>{busy ? "Loading…" : "Retry playback"}</Button> : null}
      </CardContent>
    </Card>
  );
}
