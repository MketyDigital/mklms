import type { CourseStructure } from "../../courses/domain/model.ts";
import {
  calculateCourseProgress,
  canAccessLesson,
  getNextLessonId,
} from "../../courses/domain/progress.ts";

export interface PlaybackGrantRecord {
  id: string;
  studentId: string;
  courseId: string;
  lessonId: string;
  startedAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
}

export interface VideoProgressEnrollment {
  studentId: string;
  courseId: string;
  status: string;
}

export interface VideoProgressRepository {
  getPlaybackGrant(
    grantId: string,
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<PlaybackGrantRecord | null>;
  getCourseStructure(courseId: string): Promise<CourseStructure | null>;
  getEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<VideoProgressEnrollment | null>;
  getCompletedLessonIds(
    studentId: string,
    courseId: string,
  ): Promise<ReadonlySet<string>>;
  saveLessonProgress(
    studentId: string,
    courseId: string,
    lessonId: string,
    progressPercent: number,
    lastPositionSeconds: number,
    lessonCompleted: boolean,
  ): Promise<void>;
  recordCreditedWatch?(
    grantId: string,
    studentId: string,
    courseId: string,
    lessonId: string,
    creditedSeconds: number,
  ): Promise<void>;
  markEnrollmentCompleted(studentId: string, courseId: string): Promise<void>;
}

export interface VideoProgressOptions {
  now?: () => Date;
}

export interface ReportVideoProgressInput {
  grantId: string;
  studentId: string;
  courseId: string;
  lessonId: string;
  reportedPercent: number;
  lastPositionSeconds: number;
}

export type VideoProgressResult =
  | {
      ok: true;
      lessonCompleted: boolean;
      creditedPercent: number;
      courseProgressPercent: number;
      courseCompleted: boolean;
      nextLessonId: string | null;
    }
  | {
      ok: false;
      reason:
        | "PLAYBACK_GRANT_INVALID"
        | "COURSE_NOT_AVAILABLE"
        | "ENROLLMENT_INACTIVE"
        | "LESSON_NOT_AVAILABLE"
        | "LESSON_LOCKED"
        | "VIDEO_PROGRESS_NOT_ALLOWED";
    };

export class VideoProgressService {
  private readonly repository: VideoProgressRepository;
  private readonly now: () => Date;

  constructor(
    repository: VideoProgressRepository,
    options: VideoProgressOptions = {},
  ) {
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
  }

  async reportProgress(
    input: ReportVideoProgressInput,
  ): Promise<VideoProgressResult> {
    const now = this.now();
    const grant = await this.repository.getPlaybackGrant(
      input.grantId,
      input.studentId,
      input.courseId,
      input.lessonId,
    );

    if (
      !grant ||
      grant.studentId !== input.studentId ||
      grant.courseId !== input.courseId ||
      grant.lessonId !== input.lessonId ||
      grant.revokedAt ||
      grant.startedAt.getTime() > now.getTime() ||
      grant.expiresAt.getTime() <= now.getTime()
    ) {
      return { ok: false, reason: "PLAYBACK_GRANT_INVALID" };
    }

    const [course, enrollment] = await Promise.all([
      this.repository.getCourseStructure(input.courseId),
      this.repository.getEnrollment(input.studentId, input.courseId),
    ]);

    if (!course || course.status !== "PUBLISHED") {
      return { ok: false, reason: "COURSE_NOT_AVAILABLE" };
    }

    if (
      !enrollment ||
      !["ACTIVE", "COMPLETED"].includes(enrollment.status)
    ) {
      return { ok: false, reason: "ENROLLMENT_INACTIVE" };
    }

    const lesson = course.modules
      .flatMap((courseModule) => courseModule.lessons)
      .find((candidate) => candidate.id === input.lessonId);

    if (!lesson || lesson.status !== "PUBLISHED") {
      return { ok: false, reason: "LESSON_NOT_AVAILABLE" };
    }

    if (
      lesson.completionMode !== "VIDEO_PROGRESS" ||
      !lesson.durationSeconds ||
      lesson.durationSeconds <= 0
    ) {
      return { ok: false, reason: "VIDEO_PROGRESS_NOT_ALLOWED" };
    }

    const completed = new Set(
      await this.repository.getCompletedLessonIds(input.studentId, input.courseId),
    );

    if (!canAccessLesson(course, input.lessonId, completed, enrollment)) {
      return { ok: false, reason: "LESSON_LOCKED" };
    }

    const elapsedSeconds = Math.max(
      0,
      (now.getTime() - grant.startedAt.getTime()) / 1000,
    );
    const crediblePercent = Math.min(
      100,
      Math.floor((elapsedSeconds / lesson.durationSeconds) * 100),
    );
    const reportedPercent = Math.max(
      0,
      Math.min(100, Math.floor(input.reportedPercent)),
    );
    const creditedPercent = Math.min(reportedPercent, crediblePercent);
    const creditedPositionSeconds = Math.max(
      0,
      Math.min(
        lesson.durationSeconds,
        Math.floor(input.lastPositionSeconds),
        Math.floor(elapsedSeconds),
      ),
    );
    const lessonCompleted =
      creditedPercent >= lesson.completionThresholdPercent;

    await this.repository.saveLessonProgress(
      input.studentId,
      input.courseId,
      input.lessonId,
      creditedPercent,
      creditedPositionSeconds,
      lessonCompleted,
    );
    await this.repository.recordCreditedWatch?.(
      input.grantId,
      input.studentId,
      input.courseId,
      input.lessonId,
      creditedPositionSeconds,
    );

    if (lessonCompleted) {
      completed.add(input.lessonId);
    }

    const courseProgressPercent = calculateCourseProgress(course, completed);
    const courseCompleted = courseProgressPercent === 100;

    if (courseCompleted && enrollment.status !== "COMPLETED") {
      await this.repository.markEnrollmentCompleted(
        input.studentId,
        input.courseId,
      );
    }

    return {
      ok: true,
      lessonCompleted,
      creditedPercent,
      courseProgressPercent,
      courseCompleted,
      nextLessonId:
        lessonCompleted && !courseCompleted
          ? getNextLessonId(course, input.lessonId)
          : null,
    };
  }
}
