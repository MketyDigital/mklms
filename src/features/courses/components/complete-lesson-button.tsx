"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  destinationHref,
  type NextLearningDestination,
} from "@/features/courses/domain/paid-course-progression";

interface CompleteLessonButtonProps {
  courseId: string;
  lessonId: string;
  completed: boolean;
}

interface CompleteLessonResponse {
  ok: boolean;
  courseCompleted?: boolean;
  nextDestination?: NextLearningDestination;
  message?: string;
}

export function CompleteLessonButton({
  courseId,
  lessonId,
  completed,
}: CompleteLessonButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function completeLesson() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}/complete`,
        { method: "POST" },
      );
      const result = (await response.json()) as CompleteLessonResponse;

      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "This lesson could not be completed.");
        return;
      }

      setMessage(result.courseCompleted
        ? "Course completed successfully. Preparing your certificate…"
        : "Lesson completed. Continuing to the next step…");

      const href = destinationHref(courseId, result.nextDestination ?? null);
      if (href) {
        setAdvancing(true);
        window.setTimeout(() => router.push(href), 700);
      } else {
        router.refresh();
      }
    } catch {
      setMessage("The learning service could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={completeLesson}
        disabled={busy || advancing || completed}
      >
        {completed
          ? "Lesson completed"
          : advancing
            ? "Continuing…"
            : busy
              ? "Saving progress..."
              : "Mark lesson complete"}
      </Button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
