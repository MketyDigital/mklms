import type { CourseLike, EnrollmentLike, LessonLike, ModuleLike } from "./progress.ts";

export interface PublishedQuizGate {
  id: string;
  moduleId: string;
  position: number;
}

export type NextLearningDestination =
  | { type: "QUIZ"; quizId: string }
  | { type: "LESSON"; lessonId: string }
  | { type: "CERTIFICATES" }
  | { type: "COURSE" }
  | null;

function orderedModules<TLesson extends LessonLike, TModule extends ModuleLike<TLesson>>(
  course: CourseLike<TLesson, TModule>,
): TModule[] {
  return [...course.modules].sort((a, b) => a.position - b.position);
}

function orderedLessons<TLesson extends LessonLike>(module: ModuleLike<TLesson>): TLesson[] {
  return [...module.lessons].sort((a, b) => a.position - b.position);
}

function moduleQuizzes(
  quizzes: readonly PublishedQuizGate[],
  moduleId: string,
): PublishedQuizGate[] {
  return quizzes
    .filter((quiz) => quiz.moduleId === moduleId)
    .sort((a, b) => a.position - b.position);
}

function moduleLessonsComplete(
  module: ModuleLike,
  completedLessonIds: ReadonlySet<string>,
): boolean {
  return module.lessons.every((lesson) => completedLessonIds.has(lesson.id));
}

function moduleQuizzesPassed(
  quizzes: readonly PublishedQuizGate[],
  moduleId: string,
  passedQuizIds: ReadonlySet<string>,
): boolean {
  return moduleQuizzes(quizzes, moduleId).every((quiz) => passedQuizIds.has(quiz.id));
}

function priorModulesComplete(
  course: CourseLike,
  moduleId: string,
  completedLessonIds: ReadonlySet<string>,
  quizzes: readonly PublishedQuizGate[],
  passedQuizIds: ReadonlySet<string>,
): boolean {
  const modules = orderedModules(course);
  const targetIndex = modules.findIndex((module) => module.id === moduleId);
  if (targetIndex < 0) return false;

  return modules.slice(0, targetIndex).every(
    (module) =>
      moduleLessonsComplete(module, completedLessonIds) &&
      moduleQuizzesPassed(quizzes, module.id, passedQuizIds),
  );
}

export function canAccessLessonWithQuizzes(
  course: CourseLike,
  lessonId: string,
  completedLessonIds: ReadonlySet<string>,
  quizzes: readonly PublishedQuizGate[],
  passedQuizIds: ReadonlySet<string>,
  enrollment: EnrollmentLike,
): boolean {
  const modules = orderedModules(course);
  const module = modules.find((candidate) =>
    candidate.lessons.some((lesson) => lesson.id === lessonId),
  );
  if (!module) return false;

  if (enrollment.status === "COMPLETED") {
    return module.lessons.some((lesson) => lesson.id === lessonId);
  }
  if (enrollment.status !== "ACTIVE") return false;
  if (!priorModulesComplete(course, module.id, completedLessonIds, quizzes, passedQuizIds)) {
    return false;
  }

  const lessons = orderedLessons(module);
  const lessonIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (lessonIndex < 0) return false;

  return lessons
    .slice(0, lessonIndex)
    .every((lesson) => completedLessonIds.has(lesson.id));
}

export function canAccessQuiz(
  course: CourseLike,
  quizId: string,
  completedLessonIds: ReadonlySet<string>,
  quizzes: readonly PublishedQuizGate[],
  passedQuizIds: ReadonlySet<string>,
  enrollment: EnrollmentLike,
): boolean {
  const quiz = quizzes.find((candidate) => candidate.id === quizId);
  if (!quiz) return false;

  const module = orderedModules(course).find((candidate) => candidate.id === quiz.moduleId);
  if (!module) return false;

  if (enrollment.status === "COMPLETED") return true;
  if (enrollment.status !== "ACTIVE") return false;
  if (!priorModulesComplete(course, module.id, completedLessonIds, quizzes, passedQuizIds)) {
    return false;
  }
  if (!moduleLessonsComplete(module, completedLessonIds)) return false;

  const ordered = moduleQuizzes(quizzes, module.id);
  const quizIndex = ordered.findIndex((candidate) => candidate.id === quizId);
  if (quizIndex < 0) return false;

  return ordered
    .slice(0, quizIndex)
    .every((candidate) => passedQuizIds.has(candidate.id));
}

export function areCourseRequirementsComplete(
  course: CourseLike,
  completedLessonIds: ReadonlySet<string>,
  quizzes: readonly PublishedQuizGate[],
  passedQuizIds: ReadonlySet<string>,
): boolean {
  const allLessonsComplete = orderedModules(course).every((module) =>
    moduleLessonsComplete(module, completedLessonIds),
  );
  const allQuizzesPassed = quizzes.every((quiz) => passedQuizIds.has(quiz.id));
  return allLessonsComplete && allQuizzesPassed;
}

export function getNextDestinationAfterLesson(
  course: CourseLike,
  lessonId: string,
  completedLessonIds: ReadonlySet<string>,
  quizzes: readonly PublishedQuizGate[],
  passedQuizIds: ReadonlySet<string>,
  enrollment: EnrollmentLike,
): NextLearningDestination {
  if (areCourseRequirementsComplete(course, completedLessonIds, quizzes, passedQuizIds)) {
    return { type: "CERTIFICATES" };
  }

  const modules = orderedModules(course);
  const moduleIndex = modules.findIndex((module) =>
    module.lessons.some((lesson) => lesson.id === lessonId),
  );
  if (moduleIndex < 0) return { type: "COURSE" };

  const module = modules[moduleIndex];
  const lessons = orderedLessons(module);
  const lessonIndex = lessons.findIndex((lesson) => lesson.id === lessonId);

  for (const nextLesson of lessons.slice(lessonIndex + 1)) {
    if (
      canAccessLessonWithQuizzes(
        course,
        nextLesson.id,
        completedLessonIds,
        quizzes,
        passedQuizIds,
        enrollment,
      )
    ) {
      return { type: "LESSON", lessonId: nextLesson.id };
    }
  }

  for (const quiz of moduleQuizzes(quizzes, module.id)) {
    if (
      !passedQuizIds.has(quiz.id) &&
      canAccessQuiz(course, quiz.id, completedLessonIds, quizzes, passedQuizIds, enrollment)
    ) {
      return { type: "QUIZ", quizId: quiz.id };
    }
  }

  for (const nextModule of modules.slice(moduleIndex + 1)) {
    const nextLesson = orderedLessons(nextModule)[0];
    if (
      nextLesson &&
      canAccessLessonWithQuizzes(
        course,
        nextLesson.id,
        completedLessonIds,
        quizzes,
        passedQuizIds,
        enrollment,
      )
    ) {
      return { type: "LESSON", lessonId: nextLesson.id };
    }
  }

  return { type: "COURSE" };
}

export function getNextDestinationAfterQuiz(
  course: CourseLike,
  quizId: string,
  completedLessonIds: ReadonlySet<string>,
  quizzes: readonly PublishedQuizGate[],
  passedQuizIds: ReadonlySet<string>,
  enrollment: EnrollmentLike,
): NextLearningDestination {
  if (areCourseRequirementsComplete(course, completedLessonIds, quizzes, passedQuizIds)) {
    return { type: "CERTIFICATES" };
  }

  const quiz = quizzes.find((candidate) => candidate.id === quizId);
  if (!quiz) return { type: "COURSE" };

  for (const candidate of moduleQuizzes(quizzes, quiz.moduleId)) {
    if (
      !passedQuizIds.has(candidate.id) &&
      canAccessQuiz(course, candidate.id, completedLessonIds, quizzes, passedQuizIds, enrollment)
    ) {
      return { type: "QUIZ", quizId: candidate.id };
    }
  }

  const modules = orderedModules(course);
  const moduleIndex = modules.findIndex((module) => module.id === quiz.moduleId);
  for (const nextModule of modules.slice(moduleIndex + 1)) {
    const nextLesson = orderedLessons(nextModule)[0];
    if (
      nextLesson &&
      canAccessLessonWithQuizzes(
        course,
        nextLesson.id,
        completedLessonIds,
        quizzes,
        passedQuizIds,
        enrollment,
      )
    ) {
      return { type: "LESSON", lessonId: nextLesson.id };
    }
  }

  return { type: "COURSE" };
}

export function destinationHref(
  courseId: string,
  destination: NextLearningDestination,
): string | null {
  if (!destination) return null;
  if (destination.type === "LESSON") {
    return `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(destination.lessonId)}`;
  }
  if (destination.type === "QUIZ") {
    return `/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(destination.quizId)}`;
  }
  if (destination.type === "CERTIFICATES") return "/certificates";
  return `/courses/${encodeURIComponent(courseId)}`;
}
