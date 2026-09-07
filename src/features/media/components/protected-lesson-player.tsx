"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  destinationHref,
  type NextLearningDestination,
} from "@/features/courses/domain/paid-course-progression";

interface PlaybackAuthorization {
  playbackType: "HLS" | "DIRECT" | "EMBED" | "CUSTOM";
  url: string;
  expiresAt: string | null;
  protection?: "PRIVATE_AUTHORIZATION" | "PUBLIC_SOURCE";
}

interface PlaybackResponse {
  ok: boolean;
  grantId?: string;
  authorization?: PlaybackAuthorization;
  message?: string;
  reason?: string;
}

interface ProgressResponse {
  ok: boolean;
  lessonCompleted?: boolean;
  creditedPercent?: number;
  courseCompleted?: boolean;
  nextDestination?: NextLearningDestination;
}

export interface ProtectedLessonPlayerProps {
  courseId: string;
  lessonId: string;
  completionMode: "MANUAL" | "VIDEO_PROGRESS" | "CUSTOM" | string;
  completed: boolean;
  initialProgressPercent?: number;
  initialPositionSeconds?: number;
}

export function ProtectedLessonPlayer({
  courseId,
  lessonId,
  completionMode,
  completed,
  initialProgressPercent = completed ? 100 : 0,
  initialPositionSeconds = 0,
}: ProtectedLessonPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressGrantIdRef = useRef<string | null>(null);
  const lastReportedAtRef = useRef(0);
  const resumePositionRef = useRef(Math.max(0, initialPositionSeconds));
  const advancingRef = useRef(false);
  const [authorization, setAuthorization] = useState<PlaybackAuthorization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditedPercent, setCreditedPercent] = useState(
    completed ? 100 : Math.max(0, Math.min(100, initialProgressPercent)),
  );
  const [lessonCompleted, setLessonCompleted] = useState(completed);
  const [advancing, setAdvancing] = useState(false);

  const requestPlayback = useCallback(async () => {
    const currentPosition = videoRef.current?.currentTime ?? 0;
    if (currentPosition > 0) resumePositionRef.current = currentPosition;

    const response = await fetch(
      `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/playback`,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      },
    );
    const payload = (await response.json()) as PlaybackResponse;

    if (!response.ok || !payload.ok || !payload.authorization) {
      throw new Error(payload.message ?? "Protected playback is unavailable.");
    }

    if (payload.grantId) {
      progressGrantIdRef.current = payload.grantId;
    }

    setAuthorization(payload.authorization);
    setError(null);
  }, [courseId, lessonId]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void requestPlayback()
        .catch((caught) => {
          if (active) {
            setError(caught instanceof Error ? caught.message : "Protected playback is unavailable.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [requestPlayback]);

  useEffect(() => {
    if (!authorization?.expiresAt || authorization.protection === "PUBLIC_SOURCE") return;

    const expiry = new Date(authorization.expiresAt).getTime();
    const refreshIn = Math.max(5_000, expiry - Date.now() - 30_000);
    const timer = window.setTimeout(() => {
      requestPlayback().catch(() => {
        // Existing short-lived URL may continue until expiry; player error state handles failure later.
      });
    }, refreshIn);

    return () => window.clearTimeout(timer);
  }, [authorization, requestPlayback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !authorization || authorization.playbackType === "EMBED") return;

    let destroyed = false;
    let destroyHls: (() => void) | undefined;
    const restorePosition = () => {
      if (resumePositionRef.current > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(resumePositionRef.current, Math.max(0, video.duration - 0.25));
      }
    };

    if (authorization.playbackType === "HLS") {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = authorization.url;
        video.addEventListener("loadedmetadata", restorePosition, { once: true });
      } else {
        void import("hls.js").then(({ default: Hls }) => {
          if (destroyed) return;
          if (!Hls.isSupported()) {
            setError("This browser cannot play the configured HLS stream.");
            return;
          }

          const hls = new Hls({ enableWorker: true });
          destroyHls = () => hls.destroy();
          hls.loadSource(authorization.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, restorePosition);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setError("The protected video stream could not be loaded.");
          });
        });
      }
    } else {
      video.src = authorization.url;
      video.addEventListener("loadedmetadata", restorePosition, { once: true });
    }

    return () => {
      destroyed = true;
      destroyHls?.();
    };
  }, [authorization]);

  const reportProgress = useCallback(async () => {
    if (completionMode !== "VIDEO_PROGRESS" || lessonCompleted || advancingRef.current) return;
    const grantId = progressGrantIdRef.current;
    const video = videoRef.current;
    if (!grantId || !video || !Number.isFinite(video.duration) || video.duration <= 0) return;

    const now = Date.now();
    if (now - lastReportedAtRef.current < 10_000 && !video.ended) return;
    lastReportedAtRef.current = now;

    const reportedPercent = Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100));
    const response = await fetch(
      `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/progress`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          grantId,
          reportedPercent,
          lastPositionSeconds: video.currentTime,
        }),
      },
    );

    if (!response.ok) return;
    const payload = (await response.json()) as ProgressResponse;
    if (!payload.ok) return;

    setCreditedPercent((current) => Math.max(current, payload.creditedPercent ?? 0));
    if (payload.lessonCompleted) {
      setLessonCompleted(true);
      if (payload.nextDestination && !advancingRef.current) {
        const href = destinationHref(courseId, payload.nextDestination);
        if (href) {
          advancingRef.current = true;
          setAdvancing(true);
          window.setTimeout(() => router.push(href), 700);
        }
      }
    }
  }, [completionMode, courseId, lessonCompleted, lessonId, router]);

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border bg-black/95 text-white">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="size-4 animate-spin" />
          Authorizing protected playback…
        </div>
      </div>
    );
  }

  if (error || !authorization) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        {error ?? "Protected playback is unavailable."}
      </div>
    );
  }

  if (authorization.playbackType === "EMBED") {
    return (
      <div className="space-y-2">
        <div className="aspect-video overflow-hidden rounded-lg border bg-black">
          <iframe
            title="Lesson video"
            src={authorization.url}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          External media source. Private-origin protection depends on the selected provider.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          className="aspect-video w-full bg-black"
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture={false}
          onTimeUpdate={() => void reportProgress()}
          onEnded={() => void reportProgress()}
          onContextMenu={(event) => event.preventDefault()}
        />
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur">
          <ShieldCheck className="size-3.5" /> Protected playback
        </div>
      </div>

      {completionMode === "VIDEO_PROGRESS" ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {advancing
              ? "Lesson completed. Continuing to the next step…"
              : lessonCompleted
                ? "Lesson completed"
                : "Watch progress is verified and saved automatically"}
          </span>
          <span>{Math.round(creditedPercent)}% credited</span>
        </div>
      ) : null}
    </div>
  );
}
