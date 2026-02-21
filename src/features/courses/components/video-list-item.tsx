import Link from "next/link";
import { PlayCircle, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoWithProgress } from "@/types";

export function VideoListItem({
  video,
  courseId,
  hasAccess,
}: {
  video: VideoWithProgress;
  courseId: string;
  hasAccess: boolean;
}) {
  return (
    <Link
      href={`/courses/${courseId}/videos/${video.id}`}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent",
        video.watched && "text-muted-foreground"
      )}
    >
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {video.number}
      </span>
      <span className="min-w-0 flex-1">{video.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {video.duration}
      </span>
      {video.watched ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
      ) : !hasAccess ? (
        <Lock className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
      )}
    </Link>
  );
}
