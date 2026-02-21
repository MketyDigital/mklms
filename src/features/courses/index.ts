import type { CourseService } from "./services/course.service";
import { mockCourseService } from "./services/course.mock";
import { apiCourseService } from "./services/course.api";

export const courseService: CourseService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockCourseService
    : apiCourseService;

export * from "./types";
export * from "./schemas";
export type { CourseService } from "./services/course.service";
