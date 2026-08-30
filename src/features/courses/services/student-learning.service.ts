import type { CourseStructure } from "../domain/model";
import {
  calculateCourseProgress,
  canAccessLesson,
} from "../domain/progress";
import type { LearningEnrollmentRecord } from "./learning-progress.service";

export interface StudentLearningRepository {
  listEnrollmentCourseIds(studentId: string): Promise<string[]>;
  getCourseStructure(courseId: string): Promise<CourseStructure | null>;
  getEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<LearningEnrollmentRecord | null>;
  getCompletedLessonIds(
    studentId: string,
    courseId: string,
  ): Promise<ReadonlySet<string>>;
}

export interface StudentCourseSummary {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: CourseStructure["status"];
  enrollmentStatus: string;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
}

export type StudentCourseView = CourseStructure & {
  enrollmentStatus: string;
  progressPercent: number;
  modules: Array<
    CourseStructure["modules"][number] & {
      lessons: Array<
        CourseStructure["modules"][number]["lessons"][number] & {
          completed: boolean;
          locked: boolean;
        }
      >;
    }
  >;
};

export class StudentLearningService {
  private readonly repository: StudentLearningRepository;

  constructor(repository: StudentLearningRepository) {
    this.repository = repository;
  }

  async listMyCourses(studentId: string): Promise<StudentCourseSummary[]> {
    const courseIds = await this.repository.listEnrollmentCourseIds(studentId);
    const result: StudentCourseSummary[] = [];

    for (const courseId of courseIds) {
      const [course, enrollment] = await Promise.all([
        this.repository.getCourseStructure(courseId),
        this.repository.getEnrollment(studentId, courseId),
      ]);

      if (
        !course ||
        !enrollment ||
        !["ACTIVE", "COMPLETED"].includes(enrollment.status)
      ) {
        continue;
      }

      const completed = new Set(
        await this.repository.getCompletedLessonIds(studentId, courseId),
      );
      const totalLessons = course.modules.reduce(
        (total, module) => total + module.lessons.length,
        0,
      );

      result.push({
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        status: course.status,
        enrollmentStatus: enrollment.status,
        totalLessons,
        completedLessons: completed.size,
        progressPercent: calculateCourseProgress(course, completed),
      });
    }

    return result;
  }

  async getCourseView(
    studentId: string,
    courseId: string,
  ): Promise<StudentCourseView | null> {
    const [course, enrollment] = await Promise.all([
      this.repository.getCourseStructure(courseId),
      this.repository.getEnrollment(studentId, courseId),
    ]);

    if (
      !course ||
      !enrollment ||
      !["ACTIVE", "COMPLETED"].includes(enrollment.status)
    ) {
      return null;
    }

    const completed = new Set(
      await this.repository.getCompletedLessonIds(studentId, courseId),
    );

    return {
      ...course,
      enrollmentStatus: enrollment.status,
      progressPercent: calculateCourseProgress(course, completed),
      modules: course.modules.map((module) => ({
        ...module,
        lessons: module.lessons.map((lesson) => ({
          ...lesson,
          completed: completed.has(lesson.id),
          locked: !canAccessLesson(course, lesson.id, completed, enrollment),
        })),
      })),
    };
  }
}
