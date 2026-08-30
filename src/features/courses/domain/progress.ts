export interface LessonLike {
  id: string;
  position: number;
}

export interface ModuleLike<TLesson extends LessonLike = LessonLike> {
  id: string;
  position: number;
  lessons: TLesson[];
}

export interface CourseLike<
  TLesson extends LessonLike = LessonLike,
  TModule extends ModuleLike<TLesson> = ModuleLike<TLesson>,
> {
  id: string;
  modules: TModule[];
}

export interface EnrollmentLike {
  status: "ACTIVE" | "COMPLETED" | "SUSPENDED" | "REVOKED" | string;
}

export function getOrderedLessons<TLesson extends LessonLike>(
  course: CourseLike<TLesson>,
): TLesson[] {
  return [...course.modules]
    .sort((a, b) => a.position - b.position)
    .flatMap((module) =>
      [...module.lessons].sort((a, b) => a.position - b.position),
    );
}

export function canAccessLesson(
  course: CourseLike,
  lessonId: string,
  completedLessonIds: ReadonlySet<string>,
  enrollment: EnrollmentLike,
): boolean {
  if (enrollment.status === "COMPLETED") {
    return getOrderedLessons(course).some((lesson) => lesson.id === lessonId);
  }

  if (enrollment.status !== "ACTIVE") return false;

  const ordered = getOrderedLessons(course);
  const index = ordered.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return false;
  if (index === 0) return true;

  return ordered
    .slice(0, index)
    .every((lesson) => completedLessonIds.has(lesson.id));
}

export function calculateCourseProgress(
  course: CourseLike,
  completedLessonIds: ReadonlySet<string>,
): number {
  const lessons = getOrderedLessons(course);
  if (lessons.length === 0) return 0;

  const completed = lessons.reduce(
    (total, lesson) => total + (completedLessonIds.has(lesson.id) ? 1 : 0),
    0,
  );

  return Math.round((completed / lessons.length) * 100);
}

export function getNextLessonId(
  course: CourseLike,
  lessonId: string,
): string | null {
  const lessons = getOrderedLessons(course);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0 || index >= lessons.length - 1) return null;
  return lessons[index + 1].id;
}
