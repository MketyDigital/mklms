import test from 'node:test';
import assert from 'node:assert/strict';

import { LearningProgressService } from '../src/features/courses/services/learning-progress.service.ts';

const course = {
  id: 'course-1',
  slug: 'course-one',
  title: 'Course One',
  status: 'PUBLISHED',
  position: 1,
  modules: [{
    id: 'module-1',
    courseId: 'course-1',
    title: 'Module One',
    position: 1,
    lessons: [
      { id: 'lesson-1', moduleId: 'module-1', title: 'Video Lesson', position: 1, status: 'PUBLISHED', completionMode: 'VIDEO_PROGRESS', completionThresholdPercent: 90 },
      { id: 'lesson-2', moduleId: 'module-1', title: 'Next Lesson', position: 2, status: 'PUBLISHED', completionMode: 'MANUAL', completionThresholdPercent: 100 },
    ],
  }],
};

class Repo {
  constructor({ completed = [], enrollmentStatus = 'ACTIVE' } = {}) {
    this.completed = new Set(completed);
    this.enrollment = { studentId: 'student-1', courseId: 'course-1', status: enrollmentStatus };
    this.savedProgress = [];
    this.completedEnrollment = false;
  }
  async getCourseStructure() { return course; }
  async getEnrollment() { return this.enrollment; }
  async getCompletedLessonIds() { return new Set(this.completed); }
  async saveLessonProgress(studentId, courseId, lessonId, progressPercent, lastPositionSeconds) {
    this.savedProgress.push({ studentId, courseId, lessonId, progressPercent, lastPositionSeconds });
    if (progressPercent >= 90) this.completed.add(lessonId);
  }
  async saveLessonCompletion(_studentId, _courseId, lessonId) { this.completed.add(lessonId); }
  async markEnrollmentCompleted() { this.enrollment.status = 'COMPLETED'; this.completedEnrollment = true; }
}

test('video progress below threshold is persisted without completing the lesson', async () => {
  const repo = new Repo();
  const service = new LearningProgressService(repo);

  const result = await service.recordVideoProgress('student-1', 'course-1', 'lesson-1', {
    progressPercent: 89,
    lastPositionSeconds: 356,
  });

  assert.deepEqual(result, {
    ok: true,
    lessonCompleted: false,
    courseProgressPercent: 0,
    courseCompleted: false,
    nextLessonId: null,
  });
  assert.equal(repo.completed.has('lesson-1'), false);
  assert.equal(repo.savedProgress[0].progressPercent, 89);
});

test('video progress at threshold completes the lesson and unlocks the next lesson', async () => {
  const repo = new Repo();
  const service = new LearningProgressService(repo);

  const result = await service.recordVideoProgress('student-1', 'course-1', 'lesson-1', {
    progressPercent: 90,
    lastPositionSeconds: 360,
  });

  assert.deepEqual(result, {
    ok: true,
    lessonCompleted: true,
    courseProgressPercent: 50,
    courseCompleted: false,
    nextLessonId: 'lesson-2',
  });
  assert.equal(repo.completed.has('lesson-1'), true);
});

test('media progress cannot bypass sequential locking', async () => {
  const repo = new Repo();
  const service = new LearningProgressService(repo);

  const result = await service.recordVideoProgress('student-1', 'course-1', 'lesson-2', {
    progressPercent: 100,
    lastPositionSeconds: 10,
  });

  assert.deepEqual(result, { ok: false, reason: 'LESSON_LOCKED' });
  assert.equal(repo.savedProgress.length, 0);
});

test('manual lesson rejects video-progress completion events', async () => {
  const repo = new Repo({ completed: ['lesson-1'] });
  const service = new LearningProgressService(repo);

  const result = await service.recordVideoProgress('student-1', 'course-1', 'lesson-2', {
    progressPercent: 100,
    lastPositionSeconds: 10,
  });

  assert.deepEqual(result, { ok: false, reason: 'VIDEO_PROGRESS_NOT_ALLOWED' });
  assert.equal(repo.savedProgress.length, 0);
});
