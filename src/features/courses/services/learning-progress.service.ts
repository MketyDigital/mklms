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
  saveLessonProgress?(
    studentId: string,
    courseId: string,
    lessonId: string,
    progressPercent: number,
    lastPositionSeconds: number,
    completed: boolean,
  ): Promise<void>;
  allRequiredQuizzesPassed?(
    studentId: string,
    courseId: string,
  ): Promise<boolean>;
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

export interface VideoProgressInput {
  progressPercent: number;
  lastPositionSeconds: number;
}

export type VideoProgressResult =
  | {
      ok: true;
      lessonCompleted: boolean;
      courseProgressPercent: number;
      courseCompleted: boolean;
      nextLessonId: string | null;
    }
  | {
      ok: false;
      reason:
        | "ENROLLMENT_INACTIVE"
        | "COURSE_NOT_FOUND"
        | "LESSON_LOCKED"
        | "VIDEO_PROGRESS_NOT_ALLOWED"
        | "VIDEO_PROGRESS_PERSISTENCE_UNAVAILABLE";
    };

export class LearningProgressService {
  private readonly repository: LearningProgressRepository;

  constructor(repository: LearningProgressRepository) {
    this.repository = repository;
  }

  private async allRequiredQuizzesPassed(
    studentId: string,
    courseId: string,
  ): Promise<boolean> {
    return this.repository.allRequiredQuizzesPassed
      ? this.repository.allRequiredQuizzesPassed(studentId, courseId)
      : true;
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
      .flatMap((courseModule) => courseModule.lessons)
      .find((item) => item.id === lessonId);

    if (!lesson || lesson.completionMode !== "MANUAL") {
      return { ok: false, reason: "COMPLETION_NOT_ALLOWED" };
    }

    await this.repository.saveLessonCompletion(studentId, courseId, lessonId);
    completedBefore.add(lessonId);

    const progressPercent = calculateCourseProgress(course, completedBefore);
    const courseCompleted =
      progressPercent === 100 &&
      (await this.allRequiredQuizzesPassed(studentId, courseId));

    if (courseCompleted && enrollment.status !== "COMPLETED") {
      await this.repository.markEnrollmentCompleted(studentId, courseId);
    }

    return {
      ok: true,
      progressPercent,
      courseCompleted,
      nextLessonId:
        progressPercent === 100 ? null : getNextLessonId(course, lessonId),
    };
  }

  async recordVideoProgress(
    studentId: string,
    courseId: string,
    lessonId: string,
    input: VideoProgressInput,
  ): Promise<VideoProgressResult> {
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
      .flatMap((courseModule) => courseModule.lessons)
      .find((item) => item.id === lessonId);

    if (!lesson || lesson.completionMode !== "VIDEO_PROGRESS") {
      return { ok: false, reason: "VIDEO_PROGRESS_NOT_ALLOWED" };
    }

    if (!this.repository.saveLessonProgress) {
      return { ok: false, reason: "VIDEO_PROGRESS_PERSISTENCE_UNAVAILABLE" };
    }

    const progressPercent = Math.max(0, Math.min(100, Math.round(input.progressPercent)));
    const lastPositionSeconds = Math.max(0, Math.floor(input.lastPositionSeconds));
    const alreadyCompleted = completedBefore.has(lessonId);
    const lessonCompleted =
      alreadyCompleted || progressPercent >= lesson.completionThresholdPercent;

    await this.repository.saveLessonProgress(
      studentId,
      courseId,
      lessonId,
      progressPercent,
      lastPositionSeconds,
      lessonCompleted,
    );

    if (lessonCompleted) completedBefore.add(lessonId);

    const courseProgressPercent = calculateCourseProgress(course, completedBefore);
    const courseCompleted =
      courseProgressPercent === 100 &&
      (await this.allRequiredQuizzesPassed(studentId, courseId));

    if (courseCompleted && enrollment.status !== "COMPLETED") {
      await this.repository.markEnrollmentCompleted(studentId, courseId);
    }

    return {
      ok: true,
      lessonCompleted,
      courseProgressPercent,
      courseCompleted,
      nextLessonId:
        lessonCompleted && courseProgressPercent < 100
          ? getNextLessonId(course, lessonId)
          : null,
    };
  }
}
