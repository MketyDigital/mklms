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

export interface UpdateCourseAdminInput {
  title: string;
  description?: string | null;
}

export interface CreateModuleAdminInput {
  title: string;
  description?: string | null;
}

export type UpdateModuleAdminInput = CreateModuleAdminInput;

export interface CreateLessonAdminInput {
  title: string;
  description?: string | null;
  mediaAssetId?: string | null;
  completionMode?: LessonCompletionMode;
  completionThresholdPercent?: number;
  durationSeconds?: number | null;
}

export type UpdateLessonAdminInput = CreateLessonAdminInput;

export interface AdminLearningRepository {
  listCourses(): Promise<CourseRecord[]>;
  createCourse(
    input: Omit<CourseRecord, "id" | "position" | "status"> & { status?: CourseStatus },
  ): Promise<CourseRecord>;
  updateCourse(courseId: string, input: UpdateCourseAdminInput): Promise<void>;
  deleteCourse(courseId: string): Promise<void>;
  createModule(
    courseId: string,
    input: Omit<CourseModuleRecord, "id" | "courseId" | "position">,
  ): Promise<CourseModuleRecord>;
  updateModule(moduleId: string, input: UpdateModuleAdminInput): Promise<void>;
  deleteModule(moduleId: string): Promise<void>;
  createLesson(
    moduleId: string,
    input: Omit<LessonRecord, "id" | "moduleId" | "position" | "status">,
  ): Promise<LessonRecord>;
  updateLesson(lessonId: string, input: UpdateLessonAdminInput): Promise<void>;
  deleteLesson(lessonId: string): Promise<void>;
  setCourseStatus(courseId: string, status: CourseStatus): Promise<void>;
  setLessonStatus(lessonId: string, status: LessonStatus): Promise<void>;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "course";
}

function normalizeLessonInput(input: CreateLessonAdminInput | UpdateLessonAdminInput) {
  const title = input.title.trim();
  if (!title) throw new Error("Lesson title is required.");
  const completionMode = input.completionMode ?? "VIDEO_PROGRESS";
  const threshold = input.completionThresholdPercent ?? 90;
  if (threshold < 1 || threshold > 100) throw new Error("Lesson completion threshold must be between 1 and 100.");
  const durationSeconds = input.durationSeconds ?? null;
  if (durationSeconds !== null && (!Number.isInteger(durationSeconds) || durationSeconds < 1)) {
    throw new Error("Lesson duration must be a positive whole number when provided.");
  }

  return {
    title,
    description: input.description?.trim() || null,
    mediaAssetId: input.mediaAssetId?.trim() || null,
    completionMode,
    completionThresholdPercent: completionMode === "VIDEO_PROGRESS" ? threshold : 100,
    durationSeconds: completionMode === "VIDEO_PROGRESS" ? durationSeconds : null,
  };
}

export class AdminLearningService {
  private readonly repository: AdminLearningRepository;

  constructor(repository: AdminLearningRepository) {
    this.repository = repository;
  }

  listCourses(): Promise<CourseRecord[]> { return this.repository.listCourses(); }

  async createCourse(input: CreateCourseAdminInput): Promise<CourseRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("Course title is required.");
    return this.repository.createCourse({ title, slug: slugify(input.slug || title), description: input.description?.trim() || null, status: "DRAFT" });
  }

  async updateCourse(courseId: string, input: UpdateCourseAdminInput): Promise<void> {
    const title = input.title.trim();
    if (!title) throw new Error("Course title is required.");
    await this.repository.updateCourse(courseId, { title, description: input.description?.trim() || null });
  }

  deleteCourse(courseId: string): Promise<void> { return this.repository.deleteCourse(courseId); }

  async createModule(courseId: string, input: CreateModuleAdminInput): Promise<CourseModuleRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("Module title is required.");
    return this.repository.createModule(courseId, { title, description: input.description?.trim() || null });
  }

  async updateModule(moduleId: string, input: UpdateModuleAdminInput): Promise<void> {
    const title = input.title.trim();
    if (!title) throw new Error("Module title is required.");
    await this.repository.updateModule(moduleId, { title, description: input.description?.trim() || null });
  }

  deleteModule(moduleId: string): Promise<void> { return this.repository.deleteModule(moduleId); }

  async createLesson(moduleId: string, input: CreateLessonAdminInput): Promise<LessonRecord> {
    return this.repository.createLesson(moduleId, normalizeLessonInput(input));
  }

  async updateLesson(lessonId: string, input: UpdateLessonAdminInput): Promise<void> {
    await this.repository.updateLesson(lessonId, normalizeLessonInput(input));
  }

  deleteLesson(lessonId: string): Promise<void> { return this.repository.deleteLesson(lessonId); }
  setCourseStatus(courseId: string, status: CourseStatus): Promise<void> { return this.repository.setCourseStatus(courseId, status); }
  setLessonStatus(lessonId: string, status: LessonStatus): Promise<void> { return this.repository.setLessonStatus(lessonId, status); }
}
