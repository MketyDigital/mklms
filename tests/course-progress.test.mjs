import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateCourseProgress,
  canAccessLesson,
  getOrderedLessons,
  getNextLessonId,
} from '../src/features/courses/domain/progress.ts';

const course = {
  id: 'course-1',
  modules: [
    {
      id: 'module-2',
      position: 2,
      lessons: [
        { id: 'lesson-3', position: 1 },
        { id: 'lesson-4', position: 2 },
      ],
    },
    {
      id: 'module-1',
      position: 1,
      lessons: [
        { id: 'lesson-2', position: 2 },
        { id: 'lesson-1', position: 1 },
      ],
    },
  ],
};

test('getOrderedLessons respects module and lesson positions', () => {
  assert.deepEqual(
    getOrderedLessons(course).map((lesson) => lesson.id),
    ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4'],
  );
});

test('first lesson is accessible for an active enrollment but later lessons are sequentially locked', () => {
  const enrollment = { status: 'ACTIVE' };

  assert.equal(canAccessLesson(course, 'lesson-1', new Set(), enrollment), true);
  assert.equal(canAccessLesson(course, 'lesson-2', new Set(), enrollment), false);
  assert.equal(
    canAccessLesson(course, 'lesson-2', new Set(['lesson-1']), enrollment),
    true,
  );
  assert.equal(
    canAccessLesson(course, 'lesson-3', new Set(['lesson-1']), enrollment),
    false,
  );
});

test('inactive/revoked enrollment cannot access lessons', () => {
  assert.equal(
    canAccessLesson(course, 'lesson-1', new Set(), { status: 'SUSPENDED' }),
    false,
  );
  assert.equal(
    canAccessLesson(course, 'lesson-1', new Set(), { status: 'REVOKED' }),
    false,
  );
});

test('completed enrollment can revisit any lesson regardless of sequence', () => {
  assert.equal(
    canAccessLesson(course, 'lesson-4', new Set(), { status: 'COMPLETED' }),
    true,
  );
});

test('course progress is percentage of completed lessons and reaches 100 exactly', () => {
  assert.equal(calculateCourseProgress(course, new Set()), 0);
  assert.equal(calculateCourseProgress(course, new Set(['lesson-1'])), 25);
  assert.equal(
    calculateCourseProgress(course, new Set(['lesson-1', 'lesson-2', 'lesson-3'])),
    75,
  );
  assert.equal(
    calculateCourseProgress(
      course,
      new Set(['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4']),
    ),
    100,
  );
});

test('getNextLessonId follows the flattened course order', () => {
  assert.equal(getNextLessonId(course, 'lesson-1'), 'lesson-2');
  assert.equal(getNextLessonId(course, 'lesson-2'), 'lesson-3');
  assert.equal(getNextLessonId(course, 'lesson-4'), null);
});
