import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoWithProgress } from "@/types";

export function CourseVideoList({
  videos,
  currentVideoId,
  courseId,
  courseTitle,
  className,
}: {
  videos: VideoWithProgress[];
  currentVideoId: string;
  courseId: string;
  courseTitle: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <h3 className="px-1 text-sm font-semibold tracking-tight">
        {courseTitle}
      </h3>
      <div className="mt-3 space-y-0.5">
        {videos.map((video) => {
          const isCurrent = video.id === currentVideoId;
          return (
            <Link
              key={video.id}
              href={`/courses/${courseId}/videos/${video.id}`}
              className={cn(
                "flex items-start gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                isCurrent
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <span className="mt-px w-5 shrink-0 text-right text-xs tabular-nums">
                {video.number}
              </span>
              <span className="min-w-0 flex-1 leading-snug line-clamp-2">
                {video.title}
              </span>
              {video.watched && (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
