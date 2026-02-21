"use client";

import { useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function MarkAsWatched() {
  const [watched, setWatched] = useState(false);

  return (
    <button
      onClick={() => setWatched(!watched)}
      className={cn(
        "mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
        watched
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {watched ? (
        <CheckCircle2 className="size-4" />
      ) : (
        <Check className="size-4" />
      )}
      {watched ? "Watched" : "Mark as watched"}
    </button>
  );
}
