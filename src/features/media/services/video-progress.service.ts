import type { CourseStructure } from "../../courses/domain/model.ts";
import type { PublishedQuizGate } from "../../courses/domain/paid-course-progression.ts";
import { canAccessLessonWithQuizzes } from "../../courses/domain/paid-course-progression.ts";
import {
  calculateCourseProgress,
  getNextLessonId,
} from "../../courses/domain/progress.ts";
import type { LessonProgressRecord } from "../../courses/services/student-learning.service.ts";

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
  getLessonProgress?(
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<LessonProgressRecord | null>;
  getCreditedWatchSecondsExcludingGrant?(
    studentId: string,
    courseId: string,
    lessonId: string,
    grantId: string,
  ): Promise<number>;
  listPublishedQuizGates?(courseId: string): Promise<PublishedQuizGate[]>;
  getPassedQuizIds?(studentId: string, courseId: string): Promise<ReadonlySet<string>>;
  allRequiredQuizzesPassed?(studentId: string, courseId: string): Promise<boolean>;
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

    const [completedRaw, priorProgress, otherGrantCreditedSeconds, quizGates, passedQuizIdsRaw] = await Promise.all([
      this.repository.getCompletedLessonIds(input.studentId, input.courseId),
      this.repository.getLessonProgress?.(input.studentId, input.courseId, input.lessonId) ?? Promise.resolve(null),
      this.repository.getCreditedWatchSecondsExcludingGrant?.(
        input.studentId,
        input.courseId,
        input.lessonId,
        input.grantId,
      ) ?? Promise.resolve(0),
      this.repository.listPublishedQuizGates?.(input.courseId) ?? Promise.resolve([]),
      this.repository.getPassedQuizIds?.(input.studentId, input.courseId) ?? Promise.resolve(new Set<string>()),
    ]);
    const completed = new Set(completedRaw);
    const passedQuizIds = new Set(passedQuizIdsRaw);

    if (
      !canAccessLessonWithQuizzes(
        course,
        input.lessonId,
        completed,
        quizGates,
        passedQuizIds,
        enrollment,
      )
    ) {
      return { ok: false, reason: "LESSON_LOCKED" };
    }

    const elapsedSeconds = Math.max(
      0,
      (now.getTime() - grant.startedAt.getTime()) / 1000,
    );
    const reportedPercent = Math.max(
      0,
      Math.min(100, Math.floor(input.reportedPercent)),
    );
    const currentGrantCreditedSeconds = Math.max(
      0,
      Math.min(
        lesson.durationSeconds,
        Math.floor(input.lastPositionSeconds),
        Math.floor(elapsedSeconds),
      ),
    );
    const cumulativeCreditedSeconds = Math.min(
      lesson.durationSeconds,
      Math.max(0, otherGrantCreditedSeconds) + currentGrantCreditedSeconds,
    );
    const cumulativeCrediblePercent = Math.min(
      100,
      Math.floor((cumulativeCreditedSeconds / lesson.durationSeconds) * 100),
    );
    const newlyCrediblePercent = Math.min(reportedPercent, cumulativeCrediblePercent);
    const creditedPercent = Math.max(
      priorProgress?.progressPercent ?? 0,
      newlyCrediblePercent,
    );
    const creditedPositionSeconds = Math.max(
      priorProgress?.lastPositionSeconds ?? 0,
      Math.min(Math.floor(input.lastPositionSeconds), Math.floor(cumulativeCreditedSeconds)),
    );
    const lessonCompleted =
      Boolean(priorProgress?.completed) ||
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
      currentGrantCreditedSeconds,
    );

    if (lessonCompleted) {
      completed.add(input.lessonId);
    }

    const courseProgressPercent = calculateCourseProgress(course, completed);
    const quizzesPassed = this.repository.allRequiredQuizzesPassed
      ? await this.repository.allRequiredQuizzesPassed(input.studentId, input.courseId)
      : quizGates.every((quiz) => passedQuizIds.has(quiz.id));
    const courseCompleted = courseProgressPercent === 100 && quizzesPassed;

    if (courseCompleted && enrollment.status !== "COMPLETED") {
      await this.repository.markEnrollmentCompleted(
        input.studentId,
        input.courseId,
      );
    }

    const candidateNextLessonId =
      lessonCompleted && !courseCompleted
        ? getNextLessonId(course, input.lessonId)
        : null;
    const nextLessonId =
      candidateNextLessonId &&
      canAccessLessonWithQuizzes(
        course,
        candidateNextLessonId,
        completed,
        quizGates,
        passedQuizIds,
        enrollment,
      )
        ? candidateNextLessonId
        : null;

    return {
      ok: true,
      lessonCompleted,
      creditedPercent,
      courseProgressPercent,
      courseCompleted,
      nextLessonId,
    };
  }
}
