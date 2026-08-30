import type { CourseStructure } from "./model";

export function getPublishedCourseStructure(
  course: CourseStructure,
): CourseStructure | null {
  if (course.status !== "PUBLISHED") return null;

  return {
    ...course,
    modules: course.modules
      .map((module) => ({
        ...module,
        lessons: module.lessons.filter((lesson) => lesson.status === "PUBLISHED"),
      }))
      .filter((module) => module.lessons.length > 0),
  };
}
