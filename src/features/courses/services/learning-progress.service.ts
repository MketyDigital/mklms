import type { CourseStructure } from "../domain/model.ts";
import { getPublishedCourseStructure } from "../domain/publication.ts";
import {
  calculateCourseProgress,
  canAccessLesson,
  getNextLessonId,
} from "../domain/progress.ts";

export interface LearningEnrollmentRecord {
  studentId: string;
  courseId: string;
  status: "ACTIVE" | "COMPLETED" | "SUSPENDED" | "REVOKED" | string;
}

export interface LearningProgressRepository {
  getCourseStructure(courseId: string): Promise<CourseStructure | null>;
  getEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<LearningEnrollmentRecord | null>;
  getCompletedLessonIds(
    studentId: string,
    courseId: string,
  ): Promise<ReadonlySet<string>>;
  saveLessonCompletion(
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void>;
  markEnrollmentCompleted(studentId: string, courseId: string): Promise<void>;
}

export type CompleteLessonResult =
  | {
      ok: true;
      progressPercent: number;
      courseCompleted: boolean;
      nextLessonId: string | null;
    }
  | {
      ok: false;
      reason:
        | "ENROLLMENT_INACTIVE"
        | "COURSE_NOT_FOUND"
        | "LESSON_LOCKED"
        | "COMPLETION_NOT_ALLOWED";
    };

export class LearningProgressService {
  private readonly repository: LearningProgressRepository;

  constructor(repository: LearningProgressRepository) {
    this.repository = repository;
  }

  async completeLesson(
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<CompleteLessonResult> {
    const [rawCourse, enrollment] = await Promise.all([
      this.repository.getCourseStructure(courseId),
      this.repository.getEnrollment(studentId, courseId),
    ]);
    const course = rawCourse ? getPublishedCourseStructure(rawCourse) : null;

    if (!course) return { ok: false, reason: "COURSE_NOT_FOUND" };
    if (!enrollment || !["ACTIVE", "COMPLETED"].includes(enrollment.status)) {
      return { ok: false, reason: "ENROLLMENT_INACTIVE" };
    }

    const completedBefore = new Set(
      await this.repository.getCompletedLessonIds(studentId, courseId),
    );

    if (!canAccessLesson(course, lessonId, completedBefore, enrollment)) {
      return { ok: false, reason: "LESSON_LOCKED" };
    }

    const lesson = course.modules
      .flatMap((module) => module.lessons)
      .find((item) => item.id === lessonId);

    if (!lesson || lesson.completionMode !== "MANUAL") {
      return { ok: false, reason: "COMPLETION_NOT_ALLOWED" };
    }

    await this.repository.saveLessonCompletion(studentId, courseId, lessonId);
    completedBefore.add(lessonId);

    const progressPercent = calculateCourseProgress(course, completedBefore);
    const courseCompleted = progressPercent === 100;

    if (courseCompleted && enrollment.status !== "COMPLETED") {
      await this.repository.markEnrollmentCompleted(studentId, courseId);
    }

    return {
      ok: true,
      progressPercent,
      courseCompleted,
      nextLessonId: courseCompleted ? null : getNextLessonId(course, lessonId),
    };
  }
}
