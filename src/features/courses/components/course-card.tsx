import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CourseWithProgress } from "@/types";

export function CourseCard({ course }: { course: CourseWithProgress }) {
  const progress =
    course.totalVideos > 0
      ? Math.round((course.watchedVideos / course.totalVideos) * 100)
      : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-1">
        <CardTitle className="text-base">{course.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {course.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {course.watchedVideos} / {course.totalVideos} videos watched
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/courses/${course.id}`}>
            {course.watchedVideos > 0 ? "Continue" : "Start"}
            <ArrowRight className="size-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
