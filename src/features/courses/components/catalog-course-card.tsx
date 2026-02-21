import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CourseWithProgress } from "@/types";

export function CatalogCourseCard({
  course,
  isAuthenticated = true,
}: {
  course: CourseWithProgress;
  isAuthenticated?: boolean;
}) {
  const progress =
    course.totalVideos > 0
      ? Math.round((course.watchedVideos / course.totalVideos) * 100)
      : 0;

  return (
    <Link href={`/courses/${course.id}`} className="group">
      <Card className="h-full transition-colors group-hover:border-foreground/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{course.title}</CardTitle>
            {course.status === "in_progress" && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                In progress
              </Badge>
            )}
          </div>
          <CardDescription className="line-clamp-2">
            {course.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PlayCircle className="size-4" />
            <span>{course.totalVideos} videos</span>
          </div>

          {isAuthenticated && course.watchedVideos > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {course.watchedVideos} / {course.totalVideos} watched
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
