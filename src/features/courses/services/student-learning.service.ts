import type {
  CourseModuleRecord,
  CourseRecord,
  CourseStructure,
  LessonRecord,
} from "../domain/model";
import type { PublishedQuizGate } from "../domain/paid-course-progression.ts";
import {
  canAccessLessonWithQuizzes,
  canAccessQuiz,
} from "../domain/paid-course-progression.ts";
import { getPublishedCourseStructure } from "../domain/publication.ts";
import { calculateCourseProgress } from "../domain/progress.ts";
import type { LearningEnrollmentRecord } from "./learning-progress.service";

export interface LessonProgressRecord {
  lessonId: string;
  progressPercent: number;
  lastPositionSeconds: number;
  completed: boolean;
}

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
  getLessonProgress?(
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<LessonProgressRecord | null>;
  listLessonProgress?(
    studentId: string,
    courseId: string,
  ): Promise<LessonProgressRecord[]>;
  listPublishedQuizGates?(courseId: string): Promise<PublishedQuizGate[]>;
  getPassedQuizIds?(studentId: string, courseId: string): Promise<ReadonlySet<string>>;
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

export type StudentLessonView = LessonRecord & {
  completed: boolean;
  locked: boolean;
  progressPercent: number;
  lastPositionSeconds: number;
};

export type StudentQuizGateView = PublishedQuizGate & {
  passed: boolean;
  locked: boolean;
};

export type StudentModuleView = CourseModuleRecord & {
  lessons: StudentLessonView[];
};

export type StudentCourseView = CourseRecord & {
  enrollmentStatus: string;
  progressPercent: number;
  quizGates: StudentQuizGateView[];
  modules: StudentModuleView[];
};

function buildProgressMap(
  course: CourseStructure,
  completed: ReadonlySet<string>,
  progressRecords: readonly LessonProgressRecord[],
): Map<string, LessonProgressRecord> {
  const map = new Map(progressRecords.map((record) => [record.lessonId, record]));
  for (const lesson of course.modules.flatMap((module) => module.lessons)) {
    if (completed.has(lesson.id)) {
      const existing = map.get(lesson.id);
      map.set(lesson.id, {
        lessonId: lesson.id,
        progressPercent: 100,
        lastPositionSeconds: existing?.lastPositionSeconds ?? 0,
        completed: true,
      });
    }
  }
  return map;
}

function calculateVisibleProgress(
  course: CourseStructure,
  progress: ReadonlyMap<string, LessonProgressRecord>,
): number {
  const lessons = course.modules.flatMap((module) => module.lessons);
  if (!lessons.length) return 0;
  const total = lessons.reduce(
    (sum, lesson) => sum + Math.max(0, Math.min(100, progress.get(lesson.id)?.progressPercent ?? 0)),
    0,
  );
  return Math.round(total / lessons.length);
}

export class StudentLearningService {
  private readonly repository: StudentLearningRepository;

  constructor(repository: StudentLearningRepository) {
    this.repository = repository;
  }

  async listMyCourses(studentId: string): Promise<StudentCourseSummary[]> {
    const courseIds = await this.repository.listEnrollmentCourseIds(studentId);
    const result: StudentCourseSummary[] = [];

    for (const courseId of courseIds) {
      const [rawCourse, enrollment] = await Promise.all([
        this.repository.getCourseStructure(courseId),
        this.repository.getEnrollment(studentId, courseId),
      ]);
      const course = rawCourse ? getPublishedCourseStructure(rawCourse) : null;

      if (
        !course ||
        !enrollment ||
        !["ACTIVE", "COMPLETED"].includes(enrollment.status)
      ) {
        continue;
      }

      const [completedRaw, progressRecords] = await Promise.all([
        this.repository.getCompletedLessonIds(studentId, courseId),
        this.repository.listLessonProgress?.(studentId, courseId) ?? Promise.resolve([]),
      ]);
      const completed = new Set(completedRaw);
      const progress = buildProgressMap(course, completed, progressRecords);
      const visibleLessonIds = new Set(
        course.modules.flatMap((courseModule) =>
          courseModule.lessons.map((lesson) => lesson.id),
        ),
      );
      const completedLessons = Array.from(completed).filter((lessonId) =>
        visibleLessonIds.has(lessonId),
      ).length;
      const totalLessons = visibleLessonIds.size;

      result.push({
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        status: course.status,
        enrollmentStatus: enrollment.status,
        totalLessons,
        completedLessons,
        progressPercent:
          progressRecords.length > 0
            ? calculateVisibleProgress(course, progress)
            : calculateCourseProgress(course, completed),
      });
    }

    return result;
  }

  async getCourseView(
    studentId: string,
    courseId: string,
  ): Promise<StudentCourseView | null> {
    const [rawCourse, enrollment] = await Promise.all([
      this.repository.getCourseStructure(courseId),
      this.repository.getEnrollment(studentId, courseId),
    ]);
    const course = rawCourse ? getPublishedCourseStructure(rawCourse) : null;

    if (
      !course ||
      !enrollment ||
      !["ACTIVE", "COMPLETED"].includes(enrollment.status)
    ) {
      return null;
    }

    const [completedRaw, progressRecords, quizGates, passedQuizIdsRaw] = await Promise.all([
      this.repository.getCompletedLessonIds(studentId, courseId),
      this.repository.listLessonProgress?.(studentId, courseId) ?? Promise.resolve([]),
      this.repository.listPublishedQuizGates?.(courseId) ?? Promise.resolve([]),
      this.repository.getPassedQuizIds?.(studentId, courseId) ?? Promise.resolve(new Set<string>()),
    ]);
    const completed = new Set(completedRaw);
    const passedQuizIds = new Set(passedQuizIdsRaw);
    const progress = buildProgressMap(course, completed, progressRecords);

    return {
      ...course,
      enrollmentStatus: enrollment.status,
      progressPercent:
        progressRecords.length > 0
          ? calculateVisibleProgress(course, progress)
          : calculateCourseProgress(course, completed),
      quizGates: quizGates.map((quiz) => ({
        ...quiz,
        passed: passedQuizIds.has(quiz.id),
        locked: !canAccessQuiz(
          course,
          quiz.id,
          completed,
          quizGates,
          passedQuizIds,
          enrollment,
        ),
      })),
      modules: course.modules.map((courseModule) => ({
        ...courseModule,
        lessons: courseModule.lessons.map((lesson) => {
          const saved = progress.get(lesson.id);
          return {
            ...lesson,
            completed: completed.has(lesson.id),
            progressPercent: saved?.progressPercent ?? (completed.has(lesson.id) ? 100 : 0),
            lastPositionSeconds: saved?.lastPositionSeconds ?? 0,
            locked: !canAccessLessonWithQuizzes(
              course,
              lesson.id,
              completed,
              quizGates,
              passedQuizIds,
              enrollment,
            ),
          };
        }),
      })),
    };
  }
}
