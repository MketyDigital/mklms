export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CourseAssignmentMode = "SELECTED_STUDENTS" | "ALL_ACTIVE_STUDENTS";
export type LessonStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LessonCompletionMode = "MANUAL" | "VIDEO_PROGRESS" | "CUSTOM";

export interface CourseRecord {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: CourseStatus;
  position: number;
}

export interface CourseModuleRecord {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  position: number;
}

export interface LessonRecord {
  id: string;
  moduleId: string;
  title: string;
  description?: string | null;
  position: number;
  status: LessonStatus;
  mediaAssetId?: string | null;
  completionMode: LessonCompletionMode;
  completionThresholdPercent: number;
  durationSeconds?: number | null;
}

export interface CourseStructure extends CourseRecord {
  modules: Array<
    CourseModuleRecord & {
      lessons: LessonRecord[];
    }
  >;
}

export interface StudentCourseProgress {
  studentId: string;
  courseId: string;
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "SUSPENDED" | "REVOKED";
  progressPercent: number;
  completedLessonIds: string[];
  completedAt?: Date | null;
}
