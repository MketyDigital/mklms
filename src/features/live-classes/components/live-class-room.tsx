"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, MessageCircle, Radio, Send, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  resolveBroadcastPosition,
  shouldCorrectBroadcastPosition,
} from "../domain/broadcast-position";

interface LiveRoomState {
  ok: true;
  serverNow: string;
  batch: { id: string; slug: string; title: string; description?: string | null };
  state: "UPCOMING" | "LIVE" | "BETWEEN_SESSIONS" | "ENDED";
  isLive: boolean;
  liveOffsetSeconds: number | null;
  nextStartsAt: string | null;
  displayViewerCount: number;
  activeViewers: number;
  session: { id: string; title: string; position: number; startsAt: string; durationSeconds: number } | null;
  chat: {
    staged: Array<{ id: string; offsetSeconds: number; displayName: string; message: string }>;
    own: Array<{ id: string; displayName?: string | null; message: string; createdAt: string }>;
  };
  cta: { text: string; url: string } | null;
  ended: { message: string; redirectUrl: string | null } | null;
}

interface PlaybackAuthorization {
  playbackType: "HLS" | "DIRECT" | "EMBED" | "CUSTOM";
  url: string;
  expiresAt: string | null;
}

interface PlaybackState {
  sessionId: string;
  startAtSeconds: number;
  authorization: PlaybackAuthorization;
}

function formatCountdown(targetIso: string | null, nowMs: number): string {
  if (!targetIso) return "Waiting for the next session";
  const remaining = Math.max(0, new Date(targetIso).getTime() - nowMs);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [days ? `${days}d` : null, `${String(hours).padStart(2, "0")}h`, `${String(minutes).padStart(2, "0")}m`, `${String(seconds).padStart(2, "0")}s`].filter(Boolean).join(" : ");
}

export function LiveClassRoom({ slug, organizationName }: { slug: string; organizationName: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const roomStateRef = useRef<LiveRoomState | null>(null);
  const [roomState, setRoomState] = useState<LiveRoomState | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [muted, setMuted] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const fetchState = useCallback(async () => {
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/state`, { cache: "no-store", credentials: "same-origin" });
    const payload = (await response.json()) as LiveRoomState | { ok: false; message?: string };
    if (!response.ok || !payload.ok) throw new Error("message" in payload ? payload.message ?? "This live class is unavailable." : "This live class is unavailable.");
    roomStateRef.current = payload;
    setRoomState(payload);
    setError(null);
    return payload;
  }, [slug]);

  const requestPlayback = useCallback(async () => {
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/playback`, { method: "POST", cache: "no-store", credentials: "same-origin" });
    const payload = (await response.json()) as { ok?: boolean; sessionId?: string; startAtSeconds?: number; authorization?: PlaybackAuthorization; message?: string };
    if (!response.ok || !payload.ok || !payload.authorization || !payload.sessionId) {
      throw new Error(payload.message ?? "Live broadcast is not available yet.");
    }
    const next: PlaybackState = { sessionId: payload.sessionId, startAtSeconds: payload.startAtSeconds ?? 0, authorization: payload.authorization };
    playbackRef.current = next;
    setPlayback(next);
    return next;
  }, [slug]);

  useEffect(() => {
    let active = true;
    const start = window.setTimeout(() => {
      void fetchState().catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "This live class is unavailable.");
      }).finally(() => { if (active) setLoading(false); });
    }, 0);
    const poll = window.setInterval(() => { void fetchState().catch(() => undefined); }, 10_000);
    const clock = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => { active = false; window.clearTimeout(start); window.clearInterval(poll); window.clearInterval(clock); };
  }, [fetchState]);

  useEffect(() => {
    if (roomState?.state !== "LIVE" || !roomState.session) {
      playbackRef.current = null;
      setPlayback(null);
      return;
    }
    if (playbackRef.current?.sessionId === roomState.session.id) return;
    const timer = window.setTimeout(() => { void requestPlayback().catch((caught) => setError(caught instanceof Error ? caught.message : "Live playback unavailable.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [requestPlayback, roomState?.session, roomState?.state]);

  useEffect(() => {
    if (!playback?.authorization.expiresAt) return;
    const refreshIn = Math.max(5_000, new Date(playback.authorization.expiresAt).getTime() - Date.now() - 30_000);
    const timer = window.setTimeout(() => { void requestPlayback().catch(() => undefined); }, refreshIn);
    return () => window.clearTimeout(timer);
  }, [playback?.authorization.expiresAt, requestPlayback]);

  const expectedPosition = useCallback(() => {
    const currentState = roomStateRef.current;
    if (!currentState?.session || currentState.liveOffsetSeconds === null) return playbackRef.current?.startAtSeconds ?? 0;
    return resolveBroadcastPosition({
      liveOffsetSeconds: currentState.liveOffsetSeconds,
      serverNow: new Date(currentState.serverNow),
      clientNow: new Date(),
      durationSeconds: currentState.session.durationSeconds,
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || playback.authorization.playbackType === "EMBED") return;
    let destroyed = false;
    let destroyHls: (() => void) | undefined;
    const positionAtLiveEdge = () => {
      const target = expectedPosition();
      if (Number.isFinite(video.duration)) video.currentTime = Math.min(target, Math.max(0, video.duration - 0.1));
      else video.currentTime = target;
      void video.play().catch(() => undefined);
    };

    if (playback.authorization.playbackType === "HLS") {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playback.authorization.url;
        video.addEventListener("loadedmetadata", positionAtLiveEdge, { once: true });
      } else {
        void import("hls.js").then(({ default: Hls }) => {
          if (destroyed) return;
          if (!Hls.isSupported()) { setError("This browser cannot play the live stream."); return; }
          const hls = new Hls({ enableWorker: true });
          destroyHls = () => hls.destroy();
          hls.loadSource(playback.authorization.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, positionAtLiveEdge);
          hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) setError("The live stream could not be loaded."); });
        });
      }
    } else if (playback.authorization.playbackType === "DIRECT") {
      video.src = playback.authorization.url;
      video.addEventListener("loadedmetadata", positionAtLiveEdge, { once: true });
    }

    return () => { destroyed = true; destroyHls?.(); };
  }, [expectedPosition, playback]);

  useEffect(() => {
    if (roomState?.state !== "ENDED" || !roomState.ended?.redirectUrl) return;
    const timer = window.setTimeout(() => { window.location.assign(roomState.ended!.redirectUrl!); }, 2500);
    return () => window.clearTimeout(timer);
  }, [roomState?.ended, roomState?.state]);

  const combinedChat = useMemo(() => {
    if (!roomState) return [];
    return [
      ...roomState.chat.staged.map((item) => ({ id: `staged-${item.id}`, name: item.displayName, message: item.message, mine: false })),
      ...roomState.chat.own.map((item) => ({ id: `own-${item.id}`, name: item.displayName || displayName || "You", message: item.message, mine: true })),
    ];
  }, [displayName, roomState]);

  async function sendComment() {
    const text = comment.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/live/${encodeURIComponent(slug)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ displayName: displayName.trim() || undefined, message: text }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message ?? "Comment could not be sent.");
      setComment("");
      await fetchState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Comment could not be sent.");
    } finally { setSending(false); }
  }

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-neutral-950 text-white"><Loader2 className="mr-2 size-5 animate-spin" /> Opening live room…</div>;
  if (error && !roomState) return <div className="flex min-h-dvh items-center justify-center bg-neutral-950 px-6 text-center text-white"><p>{error}</p></div>;
  if (!roomState) return null;

  if (roomState.state !== "LIVE") {
    const ended = roomState.state === "ENDED";
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-5 text-white">
        <div className="w-full max-w-2xl text-center">
          <p className="mb-4 text-sm font-medium text-white/50">{organizationName}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{roomState.batch.title}</h1>
          {ended ? (
            <><p className="mx-auto mt-5 max-w-xl text-white/65">{roomState.ended?.message ?? "This live class has ended."}</p>{roomState.ended?.redirectUrl ? <p className="mt-4 text-sm text-white/40">Redirecting…</p> : null}</>
          ) : (
            <><p className="mt-5 text-sm uppercase tracking-[0.2em] text-white/40">{roomState.state === "BETWEEN_SESSIONS" ? "Next session starts in" : "Class starts in"}</p><div className="mt-4 font-mono text-3xl font-semibold sm:text-5xl">{formatCountdown(roomState.nextStartsAt, nowMs)}</div><p className="mt-6 text-sm text-white/45">Keep this page open. The room will switch to LIVE automatically.</p></>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-neutral-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs text-white/45">{organizationName}</p><h1 className="mt-0.5 text-lg font-semibold sm:text-xl">{roomState.batch.title} · {roomState.session?.title}</h1></div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold tracking-wide"><span className="size-2 animate-pulse rounded-full bg-white" /> LIVE</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80"><Eye className="size-3.5" /> {roomState.displayViewerCount.toLocaleString()}</span>
          </div>
        </header>

        {error ? <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
              {playback?.authorization.playbackType === "EMBED" ? (
                <iframe title="Live broadcast" src={playback.authorization.url} className="h-full w-full" allow="autoplay; fullscreen" />
              ) : (
                <video
                  ref={videoRef}
                  className="h-full w-full object-contain"
                  autoPlay
                  muted={muted}
                  playsInline
                  controls={false}
                  controlsList="nodownload noremoteplayback nofullscreen"
                  disablePictureInPicture
                  onSeeking={(event) => {
                    const video = event.currentTarget;
                    const target = expectedPosition();
                    if (shouldCorrectBroadcastPosition({ currentSeconds: video.currentTime, expectedSeconds: target })) video.currentTime = target;
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                />
              )}
              <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold"><Radio className="size-3" /> LIVE</div>
              {muted && playback ? (
                <button type="button" className="absolute inset-0 flex items-center justify-center bg-black/15" onClick={() => { setMuted(false); const video = videoRef.current; if (video) { video.muted = false; void video.play().catch(() => undefined); } }}>
                  <span className="flex items-center gap-2 rounded-full bg-black/75 px-5 py-3 text-sm font-medium backdrop-blur"><Volume2 className="size-4" /> Tap to hear audio</span>
                </button>
              ) : null}
            </div>
            {roomState.cta ? <a href={roomState.cta.url} target="_blank" rel="noreferrer" className="block rounded-xl bg-white px-5 py-4 text-center font-semibold text-black transition hover:bg-white/90">{roomState.cta.text}</a> : null}
          </section>

          <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="size-4" /> Live chat</div><p className="mt-1 text-xs text-white/40">You see the class chat and your own messages. Your messages go privately to the host.</p></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {combinedChat.map((item) => <div key={item.id} className={item.mine ? "ml-8 rounded-lg bg-blue-500/15 p-3" : "rounded-lg bg-white/[0.05] p-3"}><p className="text-xs font-semibold text-white/65">{item.mine ? "You" : item.name}</p><p className="mt-1 text-sm leading-relaxed text-white/90">{item.message}</p></div>)}
              {combinedChat.length === 0 ? <p className="py-8 text-center text-xs text-white/35">Chat will appear here as the class progresses.</p> : null}
            </div>
            <div className="space-y-2 border-t border-white/10 p-3">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name (optional)" className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/30" />
              <div className="flex gap-2"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Send a private comment to the host…" className="min-h-16 resize-none border-white/10 bg-white/[0.06] text-white placeholder:text-white/30" /><Button size="icon" disabled={!comment.trim() || sending} onClick={() => void sendComment()}><Send className="size-4" /></Button></div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
