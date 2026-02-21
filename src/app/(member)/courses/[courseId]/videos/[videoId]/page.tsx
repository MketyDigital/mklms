import Link from "next/link";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
import { courseService } from "@/features/courses";
import { VideoPlayer } from "@/features/courses/components/video-player";
import { MarkAsWatched } from "@/features/courses/components/mark-as-watched";
import { ResourceLinks } from "@/features/courses/components/resource-links";
import { QASection } from "@/features/courses/components/qa-section";
import { CourseVideoList } from "@/features/courses/components/course-video-list";
import { PrevNextNavigation } from "@/features/courses/components/prev-next-navigation";

// TODO: replace with real auth session
const CURRENT_USER = {
  name: "Rahim Uddin",
  email: "rahim@example.com",
  avatar: undefined,
};

export default async function CourseVideoPage({
  params,
}: {
  params: Promise<{ courseId: string; videoId: string }>;
}) {
  const { courseId, videoId } = await params;
  const detail = await courseService.getVideoDetail(courseId, videoId);

  if (!detail) notFound();

  const { video, course, description, resources, allVideos, qaItems } = detail;

  const currentIndex = allVideos.findIndex((v) => v.id === videoId);
  const prevVideo = currentIndex > 0 ? allVideos[currentIndex - 1] : null;
  const nextVideo =
    currentIndex < allVideos.length - 1 ? allVideos[currentIndex + 1] : null;

  // TODO: replace with real auth/access check
  const memberStatus = "active" as const;
  const hasAccess = memberStatus === "active";

  return (
    <AppLayout user={CURRENT_USER} isAdmin={false} unreadMessages={3}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/courses">Courses</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/courses/${course.id}`}>{course.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                Video {video.number}: {video.title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Two-column layout */}
        <div className="mt-6 flex flex-col gap-8 lg:flex-row">
          {/* Main column */}
          <div className="min-w-0 flex-1">
            <VideoPlayer status={memberStatus} />

            {hasAccess && <MarkAsWatched />}

            {/* Video info */}
            <div className="mt-6">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {video.title}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>

              {hasAccess && <ResourceLinks resources={resources} />}
            </div>

            {/* Prev / Next */}
            <Separator className="mt-8" />
            <PrevNextNavigation
              prevVideo={prevVideo}
              nextVideo={nextVideo}
              courseId={courseId}
            />

            {/* Q&A */}
            {hasAccess && (
              <>
                <Separator className="mt-8" />
                <QASection items={qaItems} />
              </>
            )}

            {/* Mobile: video list */}
            <div className="mt-10 lg:hidden">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Course Videos</CardTitle>
                </CardHeader>
                <CardContent>
                  <CourseVideoList
                    videos={allVideos}
                    currentVideoId={videoId}
                    courseId={courseId}
                    courseTitle={course.title}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right sidebar — video list (desktop) */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-6">
              <Card>
                <CardContent className="py-4">
                  <CourseVideoList
                    videos={allVideos}
                    currentVideoId={videoId}
                    courseId={courseId}
                    courseTitle={course.title}
                  />
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
