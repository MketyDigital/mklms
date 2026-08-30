import test from 'node:test';
import assert from 'node:assert/strict';

import { LearningProgressService } from '../src/features/courses/services/learning-progress.service.ts';

const structure = {
  id: 'course-1',
  slug: 'course-one',
  title: 'Course One',
  status: 'PUBLISHED',
  position: 1,
  modules: [
    {
      id: 'module-1',
      courseId: 'course-1',
      title: 'Module One',
      position: 1,
      lessons: [
        { id: 'lesson-1', moduleId: 'module-1', title: 'Lesson 1', position: 1, status: 'PUBLISHED', completionMode: 'MANUAL', completionThresholdPercent: 100 },
        { id: 'lesson-2', moduleId: 'module-1', title: 'Lesson 2', position: 2, status: 'PUBLISHED', completionMode: 'MANUAL', completionThresholdPercent: 100 },
      ],
    },
  ],
};

class InMemoryLearningRepository {
  constructor({ enrollmentStatus = 'ACTIVE', completed = [], course = structure } = {}) {
    this.enrollment = { studentId: 'student-1', courseId: 'course-1', status: enrollmentStatus };
    this.completed = new Set(completed);
    this.completedEnrollment = false;
    this.course = course;
  }

  async getCourseStructure(courseId) {
    return courseId === 'course-1' ? this.course : null;
  }

  async getEnrollment(studentId, courseId) {
    return studentId === 'student-1' && courseId === 'course-1' ? this.enrollment : null;
  }

  async getCompletedLessonIds() {
    return new Set(this.completed);
  }

  async saveLessonCompletion(_studentId, _courseId, lessonId) {
    this.completed.add(lessonId);
  }

  async markEnrollmentCompleted() {
    this.enrollment.status = 'COMPLETED';
    this.completedEnrollment = true;
  }
}

test('completing an accessible lesson stores completion and returns updated progress', async () => {
  const repo = new InMemoryLearningRepository();
  const service = new LearningProgressService(repo);

  const result = await service.completeLesson('student-1', 'course-1', 'lesson-1');

  assert.deepEqual(result, {
    ok: true,
    progressPercent: 50,
    courseCompleted: false,
    nextLessonId: 'lesson-2',
  });
  assert.equal(repo.completed.has('lesson-1'), true);
});

test('student cannot complete a locked lesson out of sequence', async () => {
  const repo = new InMemoryLearningRepository();
  const service = new LearningProgressService(repo);

  const result = await service.completeLesson('student-1', 'course-1', 'lesson-2');

  assert.deepEqual(result, {
    ok: false,
    reason: 'LESSON_LOCKED',
  });
  assert.equal(repo.completed.size, 0);
});

test('final lesson marks enrollment completed and returns 100 percent', async () => {
  const repo = new InMemoryLearningRepository({ completed: ['lesson-1'] });
  const service = new LearningProgressService(repo);

  const result = await service.completeLesson('student-1', 'course-1', 'lesson-2');

  assert.deepEqual(result, {
    ok: true,
    progressPercent: 100,
    courseCompleted: true,
    nextLessonId: null,
  });
  assert.equal(repo.completedEnrollment, true);
  assert.equal(repo.enrollment.status, 'COMPLETED');
});

test('missing or inactive enrollment cannot complete lessons', async () => {
  const repo = new InMemoryLearningRepository({ enrollmentStatus: 'SUSPENDED' });
  const service = new LearningProgressService(repo);

  const result = await service.completeLesson('student-1', 'course-1', 'lesson-1');
  assert.deepEqual(result, { ok: false, reason: 'ENROLLMENT_INACTIVE' });
});

test('draft lessons are not completable and do not block published lessons', async () => {
  const course = {
    ...structure,
    modules: [{
      ...structure.modules[0],
      lessons: [
        structure.modules[0].lessons[0],
        { ...structure.modules[0].lessons[1], status: 'DRAFT' },
        { id: 'lesson-3', moduleId: 'module-1', title: 'Lesson 3', position: 3, status: 'PUBLISHED', completionMode: 'MANUAL', completionThresholdPercent: 100 },
      ],
    }],
  };
  const repo = new InMemoryLearningRepository({ completed: ['lesson-1'], course });
  const service = new LearningProgressService(repo);

  assert.deepEqual(
    await service.completeLesson('student-1', 'course-1', 'lesson-2'),
    { ok: false, reason: 'LESSON_LOCKED' },
  );
  assert.deepEqual(
    await service.completeLesson('student-1', 'course-1', 'lesson-3'),
    { ok: true, progressPercent: 100, courseCompleted: true, nextLessonId: null },
  );
});
