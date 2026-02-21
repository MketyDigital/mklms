import { AppLayout } from "@/components/layout/app-layout";
import { courseService } from "@/features/courses";
import { CatalogCourseCard } from "@/features/courses/components/catalog-course-card";

// TODO: replace with real auth session
const CURRENT_USER = {
  name: "Rahim Uddin",
  email: "rahim@example.com",
  avatar: undefined,
};

export default async function CourseCatalogPage() {
  const courses = await courseService.getAll();
  const totalVideos = courses.reduce((acc, c) => acc + c.totalVideos, 0);

  return (
    <AppLayout user={CURRENT_USER} isAdmin={false} unreadMessages={3}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground">
            Browse all available courses. {courses.length} courses,{" "}
            {totalVideos} videos total.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CatalogCourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
