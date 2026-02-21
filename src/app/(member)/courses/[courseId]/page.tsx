import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { courseService } from "@/features/courses";
import { VideoListItem } from "@/features/courses/components/video-list-item";

// TODO: replace with real auth session
const CURRENT_USER = {
  name: "Rahim Uddin",
  email: "rahim@example.com",
  avatar: undefined,
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, videos] = await Promise.all([
    courseService.getById(courseId),
    courseService.getVideos(courseId),
  ]);

  if (!course) notFound();

  const progress =
    course.totalVideos > 0
      ? Math.round((course.watchedVideos / course.totalVideos) * 100)
      : 0;

  // TODO: replace with real auth/access check
  const hasAccess = true;

  return (
    <AppLayout user={CURRENT_USER} isAdmin={false} unreadMessages={3}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back */}
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
          <Link href="/courses">
            <ArrowLeft className="size-4" />
            All Courses
          </Link>
        </Button>

        {/* Course info */}
        <div className="mt-4">
          <div className="flex items-start gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {course.title}
            </h1>
            {course.status === "in_progress" && (
              <Badge variant="secondary" className="shrink-0 mt-1">
                In progress
              </Badge>
            )}
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {course.description}
          </p>
        </div>

        {/* Progress */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {course.watchedVideos} of {course.totalVideos} videos watched
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Video list */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">
              Videos ({course.totalVideos})
            </CardTitle>
            <CardDescription>Click a video to start watching.</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <div className="space-y-0.5">
              {videos.map((video) => (
                <VideoListItem
                  key={video.id}
                  video={{ ...video, watched: false }}
                  courseId={courseId}
                  hasAccess={hasAccess}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
