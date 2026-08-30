"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

interface CompleteLessonButtonProps {
  courseId: string;
  lessonId: string;
  completed: boolean;
}

export function CompleteLessonButton({
  courseId,
  lessonId,
  completed,
}: CompleteLessonButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function completeLesson() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}/complete`,
        { method: "POST" },
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "This lesson could not be completed.");
        return;
      }

      if (result.courseCompleted) {
        setMessage("Course completed successfully.");
      }
      router.refresh();
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
        disabled={busy || completed}
      >
        {completed
          ? "Lesson completed"
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
