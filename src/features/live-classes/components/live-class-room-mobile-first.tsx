"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, MessageCircle, Radio, Send, TestTube2, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  appendOwnLiveComment,
  ownLiveCommentStorageKey,
  parseOwnLiveComments,
  type OwnLiveComment,
} from "../domain/live-client-cache";
import {
  resolveBroadcastPosition,
  shouldCorrectBroadcastPosition,
} from "../domain/broadcast-position";
import {
  getInitialTimelineMessages,
  getNewTimelineMessages,
  isLiveCtaVisible,
} from "../domain/live-timeline";

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
    staged: Array<{
      id: string;
      offsetSeconds: number;
      displayName: string;
      message: string;
      position: number;
    }>;
  };
  cta: { text: string; url: string; revealOffsetSeconds: number | null } | null;
  ended: { message: string; redirectUrl: string | null } | null;
}

type StagedChatMessage = LiveRoomState["chat"]["staged"][number];

type LiveChatStreamItem = {
  id: string;
  name: string;
  message: string;
  mine: boolean;
  source: "staged" | "viewer";
};

interface PlaybackAuthorization {
  playbackType: "HLS" | "DIRECT" | "EMBED" | "CUSTOM";
  url: string;
  expiresAt: string | null;
}

interface PlaybackState {
  sessionId: string;
  startAtSeconds: number;
  testMode: boolean;
  authorization: PlaybackAuthorization | null;
}

const SAFETY_STATE_REFRESH_MS = 5 * 60 * 1000;
const CHAT_REFRESH_MS = 5 * 60 * 1000;
const LIVE_CHAT_INITIAL_CONTEXT = 10;
const LIVE_CHAT_MAX_RENDERED = 80;
const LIVE_CHAT_BOTTOM_THRESHOLD_PX = 48;

type DirectSlot = 0 | 1;

function formatCountdown(targetIso: string | null, nowMs: number): string {
  if (!targetIso) return "Waiting for the next session";
  const remaining = Math.max(0, new Date(targetIso).getTime() - nowMs);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    days ? `${days}d` : null,
    `${String(hours).padStart(2, "0")}h`,
    `${String(minutes).padStart(2, "0")}m`,
    `${String(seconds).padStart(2, "0")}s`,
  ].filter(Boolean).join(" : ");
}

function stagedStreamItem(item: StagedChatMessage): LiveChatStreamItem {
  return {
    id: `staged-${item.id}`,
    name: item.displayName,
    message: item.message,
    mine: false,
    source: "staged",
  };
}

function viewerStreamItem(item: OwnLiveComment, fallbackName: string): LiveChatStreamItem {
  return {
    id: `viewer-${item.id}`,
    name: item.displayName || fallbackName || "You",
    message: item.message,
    mine: true,
    source: "viewer",
  };
}

export function LiveClassRoomMobileFirst({
  slug,
  organizationName,
}: {
  slug: string;
  organizationName: string;
}) {
  const directVideoARef = useRef<HTMLVideoElement | null>(null);
  const directVideoBRef = useRef<HTMLVideoElement | null>(null);
  const hlsVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const roomStateRef = useRef<LiveRoomState | null>(null);
  const loadedMediaSessionRef = useRef<string | null>(null);
  const loadedMediaTypeRef = useRef<PlaybackAuthorization["playbackType"] | null>(null);
  const loadedAuthorizationUrlRef = useRef<string | null>(null);
  const activeDirectSlotRef = useRef<DirectSlot>(0);
  const directSwapGenerationRef = useRef(0);
  const previousStorageKeyRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const seenStagedMessageIdsRef = useRef<Set<string>>(new Set());
  const liveChatSessionRef = useRef<string | null>(null);

  const [roomState, setRoomState] = useState<LiveRoomState | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [muted, setMuted] = useState(true);
  const [needsPlaybackGesture, setNeedsPlaybackGesture] = useState(false);
  const [activeDirectSlot, setActiveDirectSlot] = useState<DirectSlot>(0);
  const [displayName, setDisplayName] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [ownComments, setOwnComments] = useState<OwnLiveComment[]>([]);
  const [stagedChat, setStagedChat] = useState<StagedChatMessage[]>([]);
  const [chatFeedLoaded, setChatFeedLoaded] = useState(false);
  const [liveChatStream, setLiveChatStream] = useState<LiveChatStreamItem[]>([]);
  const [streamSeeded, setStreamSeeded] = useState(false);
  const [isFollowingLiveChat, setIsFollowingLiveChat] = useState(true);
  const [hasUnreadLiveChat, setHasUnreadLiveChat] = useState(false);

  const activeSessionId = roomState?.state === "LIVE" ? roomState.session?.id ?? null : null;
  const storageKey = useMemo(
    () => activeSessionId ? ownLiveCommentStorageKey(slug, activeSessionId) : null,
    [activeSessionId, slug],
  );

  const setDirectSlot = useCallback((slot: DirectSlot) => {
    activeDirectSlotRef.current = slot;
    setActiveDirectSlot(slot);
  }, []);

  const directVideoForSlot = useCallback((slot: DirectSlot) => (
    slot === 0 ? directVideoARef.current : directVideoBRef.current
  ), []);

  const currentAudioVideo = useCallback(() => {
    const authorization = playbackRef.current?.authorization;
    if (authorization?.playbackType === "DIRECT") {
      return directVideoForSlot(activeDirectSlotRef.current);
    }
    return hlsVideoRef.current;
  }, [directVideoForSlot]);

  useEffect(() => {
    const previousKey = previousStorageKeyRef.current;
    if (previousKey && previousKey !== storageKey) {
      window.localStorage.removeItem(previousKey);
    }
    previousStorageKeyRef.current = storageKey;
    setOwnComments([]);
    if (!storageKey) return;
    const timer = window.setTimeout(() => {
      setOwnComments(parseOwnLiveComments(window.localStorage.getItem(storageKey)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncViewportHeight = () => {
      document.documentElement.style.setProperty(
        "--live-visual-viewport-height",
        `${Math.round(viewport.height)}px`,
      );
    };
    syncViewportHeight();
    viewport.addEventListener("resize", syncViewportHeight);
    viewport.addEventListener("scroll", syncViewportHeight);
    return () => {
      viewport.removeEventListener("resize", syncViewportHeight);
      viewport.removeEventListener("scroll", syncViewportHeight);
      document.documentElement.style.removeProperty("--live-visual-viewport-height");
    };
  }, []);

  const fetchState = useCallback(async () => {
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/state`, {
      cache: "default",
      credentials: "same-origin",
    });
    const payload = (await response.json()) as LiveRoomState | { ok: false; message?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(
        "message" in payload
          ? payload.message ?? "This live class is unavailable."
          : "This live class is unavailable.",
      );
    }
    roomStateRef.current = payload;
    setRoomState(payload);
    setNowMs(new Date(payload.serverNow).getTime());
    setError(null);
    return payload;
  }, [slug]);

  const fetchChat = useCallback(async () => {
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/chat`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      sessionId?: string | null;
      count?: number;
      messages?: StagedChatMessage[];
      message?: string;
    };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message ?? "Live chat is temporarily unavailable.");
    }

    const currentState = roomStateRef.current;
    const expectedSessionId = currentState?.state === "LIVE"
      ? currentState.session?.id ?? null
      : null;
    if (!expectedSessionId || payload.sessionId !== expectedSessionId) {
      setStagedChat([]);
      setChatFeedLoaded(false);
      return payload;
    }

    setStagedChat(Array.isArray(payload.messages) ? payload.messages : []);
    setChatFeedLoaded(true);
    return payload;
  }, [slug]);

  const requestPlayback = useCallback(async () => {
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/playback`, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      sessionId?: string;
      startAtSeconds?: number;
      testMode?: boolean;
      authorization?: PlaybackAuthorization | null;
      message?: string;
    };
    if (!response.ok || !payload.ok || !payload.sessionId) {
      throw new Error(payload.message ?? "Live broadcast is not available yet.");
    }
    const next: PlaybackState = {
      sessionId: payload.sessionId,
      startAtSeconds: payload.startAtSeconds ?? 0,
      testMode: payload.testMode === true,
      authorization: payload.authorization ?? null,
    };
    playbackRef.current = next;
    setPlayback(next);
    setError(null);
    return next;
  }, [slug]);

  useEffect(() => {
    let active = true;
    const initialFetch = window.setTimeout(() => {
      void fetchState()
        .catch((caught) => {
          if (active) {
            setError(caught instanceof Error ? caught.message : "This live class is unavailable.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    const clock = window.setInterval(() => setNowMs(Date.now()), 1_000);
    const safetyRefresh = window.setInterval(
      () => void fetchState().catch(() => undefined),
      SAFETY_STATE_REFRESH_MS,
    );
    const refreshVisiblePlayback = () => {
      void fetchState().catch(() => undefined);
      void fetchChat().catch(() => undefined);
      if (roomStateRef.current?.state === "LIVE") {
        void requestPlayback().catch(() => setNeedsPlaybackGesture(true));
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshVisiblePlayback();
    };
    const onPageShow = () => refreshVisiblePlayback();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      active = false;
      window.clearTimeout(initialFetch);
      window.clearInterval(clock);
      window.clearInterval(safetyRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [fetchChat, fetchState, requestPlayback]);

  useEffect(() => {
    if (!roomState) return;
    let transitionAtMs: number | null = null;
    if (
      (roomState.state === "UPCOMING" || roomState.state === "BETWEEN_SESSIONS") &&
      roomState.nextStartsAt
    ) {
      transitionAtMs = new Date(roomState.nextStartsAt).getTime();
    } else if (roomState.state === "LIVE" && roomState.session) {
      transitionAtMs =
        new Date(roomState.session.startsAt).getTime() +
        roomState.session.durationSeconds * 1000;
    }
    if (transitionAtMs === null || !Number.isFinite(transitionAtMs)) return;
    const delay = Math.max(500, transitionAtMs - Date.now() + 1_000);
    const timer = window.setTimeout(
      () => void fetchState().catch(() => undefined),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [fetchState, roomState]);

  const roomSessionId = activeSessionId;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      liveChatSessionRef.current = activeSessionId;
      seenStagedMessageIdsRef.current = new Set();
      setStagedChat([]);
      setChatFeedLoaded(false);
      setLiveChatStream([]);
      setStreamSeeded(false);
      setIsFollowingLiveChat(true);
      setHasUnreadLiveChat(false);
      if (activeSessionId) void fetchChat().catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeSessionId, fetchChat]);

  useEffect(() => {
    if (!activeSessionId) return;
    const timer = window.setInterval(
      () => void fetchChat().catch(() => undefined),
      CHAT_REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, [activeSessionId, fetchChat]);

  useEffect(() => {
    if (roomState?.state !== "LIVE" || !roomSessionId) return;
    if (playbackRef.current?.sessionId === roomSessionId) return;
    const timer = window.setTimeout(() => {
      void requestPlayback().catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Live playback unavailable."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestPlayback, roomSessionId, roomState?.state]);

  useEffect(() => {
    const expiry = playback?.authorization?.expiresAt;
    if (!expiry || roomState?.state !== "LIVE") return;
    const refreshIn = Math.max(
      5_000,
      new Date(expiry).getTime() - Date.now() - 30_000,
    );
    const timer = window.setTimeout(
      () => void requestPlayback().catch(() => undefined),
      refreshIn,
    );
    return () => window.clearTimeout(timer);
  }, [playback?.authorization?.expiresAt, requestPlayback, roomState?.state]);

  const currentLiveOffsetSeconds = useMemo(() => {
    if (
      !roomState?.session ||
      roomState.liveOffsetSeconds === null ||
      roomState.state !== "LIVE"
    ) return 0;
    return resolveBroadcastPosition({
      liveOffsetSeconds: roomState.liveOffsetSeconds,
      serverNow: new Date(roomState.serverNow),
      clientNow: new Date(nowMs || new Date(roomState.serverNow).getTime()),
      durationSeconds: roomState.session.durationSeconds,
    });
  }, [nowMs, roomState]);

  const timelineSource = useMemo(() => {
    if (!roomState || roomState.state !== "LIVE") return [];
    return chatFeedLoaded ? stagedChat : roomState.chat.staged;
  }, [chatFeedLoaded, roomState, stagedChat]);

  useEffect(() => {
    if (!activeSessionId || liveChatSessionRef.current !== activeSessionId || streamSeeded) return;
    if (!chatFeedLoaded && timelineSource.length === 0) return;
    const timer = window.setTimeout(() => {
      const reached = getNewTimelineMessages(
        timelineSource,
        currentLiveOffsetSeconds,
        new Set<string>(),
      );
      seenStagedMessageIdsRef.current = new Set(reached.map((item) => item.id));
      const initial = getInitialTimelineMessages(
        timelineSource,
        currentLiveOffsetSeconds,
        LIVE_CHAT_INITIAL_CONTEXT,
      );
      setLiveChatStream(initial.map(stagedStreamItem));
      setStreamSeeded(true);
      setIsFollowingLiveChat(true);
      setHasUnreadLiveChat(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    activeSessionId,
    chatFeedLoaded,
    currentLiveOffsetSeconds,
    streamSeeded,
    timelineSource,
  ]);

  useEffect(() => {
    if (!activeSessionId || !streamSeeded) return;
    const newlyReached = getNewTimelineMessages(
      timelineSource,
      currentLiveOffsetSeconds,
      seenStagedMessageIdsRef.current,
    );
    if (newlyReached.length === 0) return;
    newlyReached.forEach((item) => seenStagedMessageIdsRef.current.add(item.id));
    const timer = window.setTimeout(() => {
      setLiveChatStream((current) => [
        ...current,
        ...newlyReached.map(stagedStreamItem),
      ].slice(-LIVE_CHAT_MAX_RENDERED));
      if (!isFollowingLiveChat) setHasUnreadLiveChat(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    activeSessionId,
    currentLiveOffsetSeconds,
    isFollowingLiveChat,
    streamSeeded,
    timelineSource,
  ]);

  useEffect(() => {
    if (!streamSeeded || ownComments.length === 0) return;
    const timer = window.setTimeout(() => {
      setLiveChatStream((current) => {
        const currentIds = new Set(current.map((item) => item.id));
        const restored = ownComments
          .map((item) => viewerStreamItem(item, displayName))
          .filter((item) => !currentIds.has(item.id));
        return restored.length
          ? [...current, ...restored].slice(-LIVE_CHAT_MAX_RENDERED)
          : current;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [displayName, ownComments, streamSeeded]);

  const scrollChatToLive = useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = chatScrollRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    if (!isFollowingLiveChat || liveChatStream.length === 0) return;
    const frame = window.requestAnimationFrame(() => scrollChatToLive("smooth"));
    return () => window.cancelAnimationFrame(frame);
  }, [isFollowingLiveChat, liveChatStream.length, scrollChatToLive]);

  const handleChatScroll = useCallback(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const following = distanceFromBottom <= LIVE_CHAT_BOTTOM_THRESHOLD_PX;
    setIsFollowingLiveChat(following);
    if (following) setHasUnreadLiveChat(false);
  }, []);

  const followLiveChat = useCallback(() => {
    setIsFollowingLiveChat(true);
    setHasUnreadLiveChat(false);
    scrollChatToLive("smooth");
  }, [scrollChatToLive]);

  const expectedPosition = useCallback(() => {
    const currentState = roomStateRef.current;
    if (!currentState?.session || currentState.liveOffsetSeconds === null) {
      return playbackRef.current?.startAtSeconds ?? 0;
    }
    return resolveBroadcastPosition({
      liveOffsetSeconds: currentState.liveOffsetSeconds,
      serverNow: new Date(currentState.serverNow),
      clientNow: new Date(),
      durationSeconds: currentState.session.durationSeconds,
    });
  }, []);

  const correctPosition = useCallback((video: HTMLVideoElement) => {
    const target = expectedPosition();
    video.currentTime = Number.isFinite(video.duration)
      ? Math.min(target, Math.max(0, video.duration - 0.1))
      : target;
  }, [expectedPosition]);

  useEffect(() => {
    const authorization = playback?.authorization;
    if (
      !authorization ||
      !playback ||
      roomState?.state !== "LIVE" ||
      authorization.playbackType === "EMBED"
    ) return;

    const sameLoadedMedia =
      loadedMediaSessionRef.current === playback.sessionId &&
      loadedMediaTypeRef.current === authorization.playbackType;
    const sameAuthorization = loadedAuthorizationUrlRef.current === authorization.url;
    if (sameLoadedMedia && sameAuthorization) return;

    if (authorization.playbackType === "DIRECT") {
      const currentSlot = activeDirectSlotRef.current;
      const targetSlot: DirectSlot = sameLoadedMedia ? (currentSlot === 0 ? 1 : 0) : currentSlot;
      const targetVideo = directVideoForSlot(targetSlot);
      const currentVideo = directVideoForSlot(currentSlot);
      if (!targetVideo) return;

      const generation = ++directSwapGenerationRef.current;
      targetVideo.muted = true;
      targetVideo.preload = "auto";

      const promote = async () => {
        if (generation !== directSwapGenerationRef.current) return;
        correctPosition(targetVideo);
        try {
          await targetVideo.play();
        } catch {
          setNeedsPlaybackGesture(true);
          return;
        }
        if (generation !== directSwapGenerationRef.current) return;

        setNeedsPlaybackGesture(false);
        if (!sameLoadedMedia || targetSlot === currentSlot) {
          targetVideo.muted = muted;
          setDirectSlot(targetSlot);
        } else {
          targetVideo.muted = muted;
          if (currentVideo) currentVideo.muted = true;
          setDirectSlot(targetSlot);
          window.setTimeout(() => {
            if (generation !== directSwapGenerationRef.current || !currentVideo) return;
            currentVideo.pause();
            currentVideo.removeAttribute("src");
            currentVideo.load();
          }, 350);
        }

        loadedMediaSessionRef.current = playback.sessionId;
        loadedMediaTypeRef.current = authorization.playbackType;
        loadedAuthorizationUrlRef.current = authorization.url;
      };

      targetVideo.addEventListener("loadedmetadata", () => void promote(), { once: true });
      targetVideo.src = authorization.url;
      targetVideo.load();
      return;
    }

    const video = hlsVideoRef.current;
    if (!video || authorization.playbackType !== "HLS") return;
    let destroyed = false;
    let destroyHls: (() => void) | undefined;

    const positionAtLiveEdge = () => {
      correctPosition(video);
      void video.play()
        .then(() => setNeedsPlaybackGesture(false))
        .catch(() => setNeedsPlaybackGesture(true));
      loadedMediaSessionRef.current = playback.sessionId;
      loadedMediaTypeRef.current = authorization.playbackType;
      loadedAuthorizationUrlRef.current = authorization.url;
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = authorization.url;
      video.addEventListener("loadedmetadata", positionAtLiveEdge, { once: true });
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) {
          setError("This browser cannot play the live stream.");
          return;
        }
        const hls = new Hls({ enableWorker: true });
        destroyHls = () => hls.destroy();
        hls.loadSource(authorization.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, positionAtLiveEdge);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setNeedsPlaybackGesture(true);
            setError("The live stream could not be loaded.");
          }
        });
      });
    }

    return () => {
      destroyed = true;
      destroyHls?.();
    };
  }, [
    correctPosition,
    directVideoForSlot,
    muted,
    playback,
    roomState?.state,
    setDirectSlot,
  ]);

  useEffect(() => {
    const redirectUrl = roomState?.ended?.redirectUrl;
    if (roomState?.state !== "ENDED" || !redirectUrl) return;
    const timer = window.setTimeout(() => window.location.assign(redirectUrl), 2_500);
    return () => window.clearTimeout(timer);
  }, [roomState?.ended?.redirectUrl, roomState?.state]);

  const visibleCta = useMemo(() => {
    if (!roomState?.cta || roomState.state !== "LIVE") return null;
    return isLiveCtaVisible({
      liveOffsetSeconds: currentLiveOffsetSeconds,
      revealOffsetSeconds: roomState.cta.revealOffsetSeconds,
    }) ? roomState.cta : null;
  }, [currentLiveOffsetSeconds, roomState]);

  async function sendComment() {
    const text = comment.trim();
    if (!text || sending || !activeSessionId) return;
    setSending(true);
    try {
      const response = await fetch(`/api/live/${encodeURIComponent(slug)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          message: text,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: OwnLiveComment | string;
      };
      if (
        !response.ok ||
        !payload.ok ||
        !payload.message ||
        typeof payload.message === "string"
      ) {
        throw new Error(
          typeof payload.message === "string"
            ? payload.message
            : "Comment could not be sent.",
        );
      }
      const next = appendOwnLiveComment(ownComments, payload.message);
      setOwnComments(next);
      setLiveChatStream((current) => [
        ...current.filter((item) => item.id !== `viewer-${payload.message.id}`),
        viewerStreamItem(payload.message, displayName),
      ].slice(-LIVE_CHAT_MAX_RENDERED));
      setIsFollowingLiveChat(true);
      setHasUnreadLiveChat(false);
      if (storageKey) window.localStorage.setItem(storageKey, JSON.stringify(next));
      setComment("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Comment could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  const handleSeeking = (video: HTMLVideoElement) => {
    const target = expectedPosition();
    if (
      shouldCorrectBroadcastPosition({
        currentSeconds: video.currentTime,
        expectedSeconds: target,
      })
    ) {
      video.currentTime = target;
    }
  };

  const handlePlaybackPaused = (video: HTMLVideoElement) => {
    if (
      document.visibilityState === "visible" &&
      video === currentAudioVideo() &&
      !video.ended
    ) {
      setNeedsPlaybackGesture(true);
    }
  };

  const handlePlaybackError = (video: HTMLVideoElement) => {
    if (video !== currentAudioVideo()) return;
    setNeedsPlaybackGesture(true);
    void requestPlayback().catch(() => undefined);
  };

  const resumePlayback = () => {
    setMuted(false);
    setNeedsPlaybackGesture(false);
    const video = currentAudioVideo();
    if (!video) {
      void requestPlayback().catch(() => setNeedsPlaybackGesture(true));
      return;
    }
    video.muted = false;
    correctPosition(video);
    void video.play().catch(() => {
      setNeedsPlaybackGesture(true);
      void requestPlayback().catch(() => setNeedsPlaybackGesture(true));
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950 text-white">
        <Loader2 className="mr-2 size-5 animate-spin" /> Opening live room…
      </div>
    );
  }

  if (error && !roomState) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950 px-6 text-center text-white">
        <p>{error}</p>
      </div>
    );
  }
  if (!roomState) return null;

  if (roomState.state !== "LIVE") {
    const ended = roomState.state === "ENDED";
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-5 text-white">
        <div className="w-full max-w-2xl text-center">
          <p className="mb-4 text-sm font-medium text-white/50">{organizationName}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            {roomState.batch.title}
          </h1>
          {ended ? (
            <>
              <p className="mx-auto mt-5 max-w-xl text-white/65">
                {roomState.ended?.message ?? "This live class has ended."}
              </p>
              {roomState.ended?.redirectUrl ? (
                <p className="mt-4 text-sm text-white/40">Redirecting…</p>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-5 text-sm uppercase tracking-[0.2em] text-white/40">
                {roomState.state === "BETWEEN_SESSIONS"
                  ? "Next session starts in"
                  : "Class starts in"}
              </p>
              <div className="mt-4 font-mono text-3xl font-semibold sm:text-5xl">
                {formatCountdown(roomState.nextStartsAt, nowMs)}
              </div>
              <p className="mt-6 text-sm text-white/45">
                Keep this page open. The room will switch to LIVE automatically.
              </p>
            </>
          )}
        </div>
      </main>
    );
  }

  const isTestMode = playback?.testMode === true;
  const authorization = playback?.authorization ?? null;

  return (
    <main className="min-h-dvh bg-neutral-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
        <header className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-white/45">{organizationName}</p>
            <h1 className="mt-0.5 truncate text-base font-semibold sm:text-xl">
              {roomState.batch.title} · {roomState.session?.title}
            </h1>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-xs text-white/80 sm:px-3">
            <Eye className="size-3.5" /> {roomState.displayViewerCount.toLocaleString()}
          </span>
        </header>

        {error ? (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto] lg:gap-4">
          <div
            data-live-player
            className="sticky top-0 z-30 -mx-4 shrink-0 bg-neutral-950 px-4 pb-2 pt-1 sm:-mx-6 sm:px-6 lg:static lg:col-start-1 lg:row-start-1 lg:mx-0 lg:bg-transparent lg:p-0"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
              {isTestMode ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center sm:px-8">
                  <div className="rounded-full bg-blue-500/15 p-3 sm:p-4">
                    <TestTube2 className="size-7 text-blue-300 sm:size-8" />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold sm:mt-4 sm:text-xl">
                    Live room test mode
                  </h2>
                  <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/55 sm:text-sm">
                    No video is attached. LIVE timing, viewer count, synchronized chat and CTA timing are running normally.
                  </p>
                </div>
              ) : authorization?.playbackType === "EMBED" ? (
                <iframe
                  title="Live broadcast"
                  src={authorization.url}
                  className="h-full w-full"
                  allow="autoplay; fullscreen"
                />
              ) : authorization?.playbackType === "DIRECT" ? (
                <>
                  {[0, 1].map((slotValue) => {
                    const slot = slotValue as DirectSlot;
                    return (
                      <video
                        key={slot}
                        ref={slot === 0 ? directVideoARef : directVideoBRef}
                        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
                          activeDirectSlot === slot ? "opacity-100" : "pointer-events-none opacity-0"
                        }`}
                        autoPlay
                        muted={muted || activeDirectSlot !== slot}
                        playsInline
                        preload="auto"
                        controls={false}
                        controlsList="nodownload noremoteplayback nofullscreen"
                        disablePictureInPicture
                        onSeeking={(event) => handleSeeking(event.currentTarget)}
                        onPause={(event) => handlePlaybackPaused(event.currentTarget)}
                        onPlaying={() => setNeedsPlaybackGesture(false)}
                        onError={(event) => handlePlaybackError(event.currentTarget)}
                        onContextMenu={(event) => event.preventDefault()}
                      />
                    );
                  })}
                </>
              ) : authorization?.playbackType === "HLS" ? (
                <video
                  ref={hlsVideoRef}
                  className="h-full w-full object-contain"
                  autoPlay
                  muted={muted}
                  playsInline
                  controls={false}
                  controlsList="nodownload noremoteplayback nofullscreen"
                  disablePictureInPicture
                  onSeeking={(event) => handleSeeking(event.currentTarget)}
                  onPause={(event) => handlePlaybackPaused(event.currentTarget)}
                  onPlaying={() => setNeedsPlaybackGesture(false)}
                  onError={(event) => handlePlaybackError(event.currentTarget)}
                  onContextMenu={(event) => event.preventDefault()}
                />
              ) : authorization ? (
                <div className="flex h-full items-center justify-center text-sm text-white/45">
                  Unsupported live media type.
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/45">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Preparing live broadcast…
                </div>
              )}

              <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold">
                <Radio className="size-3" /> LIVE
              </div>

              {(muted || needsPlaybackGesture) && authorization && authorization.playbackType !== "EMBED" ? (
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center bg-black/15"
                  onClick={resumePlayback}
                >
                  <span className="flex items-center gap-2 rounded-full bg-black/75 px-5 py-3 text-sm font-medium backdrop-blur">
                    <Volume2 className="size-4" /> {needsPlaybackGesture ? "Tap to resume" : "Tap to hear audio"}
                  </span>
                </button>
              ) : null}
            </div>
          </div>

          {visibleCta ? (
            <div className="lg:col-start-1 lg:row-start-2">
              <a
                href={visibleCta.url}
                target="_blank"
                rel="noreferrer noopener"
                className="block rounded-xl bg-white px-5 py-4 text-center font-semibold text-black transition hover:bg-white/90"
              >
                {visibleCta.text}
              </a>
            </div>
          ) : (
            <div className="hidden lg:col-start-1 lg:row-start-2 lg:block" />
          )}

          <aside className="relative flex min-h-[60dvh] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-[520px] lg:max-h-[calc(100dvh-7rem)]">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircle className="size-4" /> Live chat
              </div>
            </div>
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
            >
              {liveChatStream.map((item) => (
                <div
                  key={item.id}
                  className={
                    item.mine
                      ? "ml-8 rounded-lg bg-blue-500/15 p-3"
                      : "rounded-lg bg-white/[0.05] p-3"
                  }
                >
                  <p className="text-xs font-semibold text-white/65">
                    {item.mine ? "You" : item.name}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                    {item.message}
                  </p>
                </div>
              ))}
              {liveChatStream.length === 0 ? (
                <p className="py-8 text-center text-xs text-white/35">
                  Chat will appear here as the class progresses.
                </p>
              ) : null}
            </div>
            {hasUnreadLiveChat ? (
              <div className="pointer-events-none absolute bottom-32 left-0 right-0 flex justify-center px-4">
                <Button
                  type="button"
                  size="sm"
                  className="pointer-events-auto rounded-full shadow-lg"
                  onClick={followLiveChat}
                >
                  New messages
                </Button>
              </div>
            ) : null}
            <div className="space-y-2 border-t border-white/10 bg-neutral-950/60 p-3 backdrop-blur">
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name (optional)"
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/30"
              />
              <div className="flex gap-2">
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={2}
                  placeholder="Write a comment…"
                  className="min-h-16 resize-none border-white/10 bg-white/[0.06] text-white placeholder:text-white/30"
                />
                <Button
                  size="icon"
                  disabled={!comment.trim() || sending}
                  onClick={() => void sendComment()}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
