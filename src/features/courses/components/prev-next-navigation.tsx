import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VideoWithProgress } from "@/types";

export function PrevNextNavigation({
  prevVideo,
  nextVideo,
  courseId,
}: {
  prevVideo: VideoWithProgress | null;
  nextVideo: VideoWithProgress | null;
  courseId: string;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      {prevVideo ? (
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href={`/courses/${courseId}/videos/${prevVideo.id}`}>
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline truncate max-w-[200px]">
              {prevVideo.title}
            </span>
            <span className="sm:hidden">Previous</span>
          </Link>
        </Button>
      ) : (
        <div />
      )}
      {nextVideo ? (
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href={`/courses/${courseId}/videos/${nextVideo.id}`}>
            <span className="hidden sm:inline truncate max-w-[200px]">
              {nextVideo.title}
            </span>
            <span className="sm:hidden">Next</span>
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <div />
      )}
    </div>
  );
}
