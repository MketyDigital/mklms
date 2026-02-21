import { AppLayout } from "@/components/layout/app-layout";
import { courseService } from "@/features/courses";
import { CreateCourseDialog } from "@/features/courses/components/admin/create-course-dialog";
import { AdminCourseList } from "@/features/courses/components/admin/admin-course-list";

const CURRENT_USER = {
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  avatar: undefined,
};

export default async function AdminCoursesPage() {
  const courses = await courseService.getAll();

  return (
    <AppLayout user={CURRENT_USER} isAdmin={true} unreadMessages={5}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Manage Courses
            </h1>
            <p className="text-sm text-muted-foreground">
              {courses.length} courses
            </p>
          </div>
          <CreateCourseDialog />
        </div>
        <AdminCourseList courses={courses} />
      </div>
    </AppLayout>
  );
}
