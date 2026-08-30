import type {
  CourseModuleRecord,
  CourseRecord,
  CourseStatus,
  LessonCompletionMode,
  LessonRecord,
  LessonStatus,
} from "../domain/model";

export interface CreateCourseAdminInput {
  title: string;
  description?: string | null;
  slug?: string | null;
}

export interface CreateModuleAdminInput {
  title: string;
  description?: string | null;
}

export interface CreateLessonAdminInput {
  title: string;
  description?: string | null;
  mediaAssetId?: string | null;
  completionMode?: LessonCompletionMode;
  completionThresholdPercent?: number;
  durationSeconds?: number | null;
}

export interface AdminLearningRepository {
  listCourses(): Promise<CourseRecord[]>;
  createCourse(
    input: Omit<CourseRecord, "id" | "position" | "status"> & {
      status?: CourseStatus;
    },
  ): Promise<CourseRecord>;
  createModule(
    courseId: string,
    input: Omit<CourseModuleRecord, "id" | "courseId" | "position">,
  ): Promise<CourseModuleRecord>;
  createLesson(
    moduleId: string,
    input: Omit<LessonRecord, "id" | "moduleId" | "position" | "status">,
  ): Promise<LessonRecord>;
  setCourseStatus(courseId: string, status: CourseStatus): Promise<void>;
  setLessonStatus(lessonId: string, status: LessonStatus): Promise<void>;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "course";
}

export class AdminLearningService {
  private readonly repository: AdminLearningRepository;

  constructor(repository: AdminLearningRepository) {
    this.repository = repository;
  }

  listCourses(): Promise<CourseRecord[]> {
    return this.repository.listCourses();
  }

  async createCourse(input: CreateCourseAdminInput): Promise<CourseRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("Course title is required.");

    return this.repository.createCourse({
      title,
      slug: slugify(input.slug || title),
      description: input.description?.trim() || null,
      status: "DRAFT",
    });
  }

  async createModule(
    courseId: string,
    input: CreateModuleAdminInput,
  ): Promise<CourseModuleRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("Module title is required.");

    return this.repository.createModule(courseId, {
      title,
      description: input.description?.trim() || null,
    });
  }

  async createLesson(
    moduleId: string,
    input: CreateLessonAdminInput,
  ): Promise<LessonRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("Lesson title is required.");

    const threshold = input.completionThresholdPercent ?? 90;
    if (threshold < 1 || threshold > 100) {
      throw new Error("Lesson completion threshold must be between 1 and 100.");
    }

    return this.repository.createLesson(moduleId, {
      title,
      description: input.description?.trim() || null,
      mediaAssetId: input.mediaAssetId?.trim() || null,
      completionMode: input.completionMode ?? "VIDEO_PROGRESS",
      completionThresholdPercent: threshold,
      durationSeconds: input.durationSeconds ?? null,
    });
  }

  setCourseStatus(courseId: string, status: CourseStatus): Promise<void> {
    return this.repository.setCourseStatus(courseId, status);
  }

  setLessonStatus(lessonId: string, status: LessonStatus): Promise<void> {
    return this.repository.setLessonStatus(lessonId, status);
  }
}
