import test from 'node:test';
import assert from 'node:assert/strict';

import { VideoProgressService } from '../src/features/media/services/video-progress.service.ts';

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
      {
        id: 'lesson-1', moduleId: 'module-1', title: 'Video Lesson', position: 1,
        status: 'PUBLISHED', mediaAssetId: 'media-1', completionMode: 'VIDEO_PROGRESS',
        completionThresholdPercent: 90, durationSeconds: 100,
      },
      {
        id: 'lesson-2', moduleId: 'module-1', title: 'Next Lesson', position: 2,
        status: 'PUBLISHED', completionMode: 'MANUAL', completionThresholdPercent: 100,
      },
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

  async getPlaybackGrant(grantId, studentId, courseId, lessonId) {
    if (grantId !== 'grant-1') return null;
    return {
      id: grantId,
      studentId,
      courseId,
      lessonId,
      startedAt: new Date('2026-08-30T14:00:00.000Z'),
      expiresAt: new Date('2026-08-30T15:00:00.000Z'),
      revokedAt: null,
    };
  }

  async getCourseStructure() { return course; }
  async getEnrollment() { return this.enrollment; }
  async getCompletedLessonIds() { return new Set(this.completed); }
  async saveLessonProgress(studentId, courseId, lessonId, progressPercent, lastPositionSeconds) {
    this.savedProgress.push({ studentId, courseId, lessonId, progressPercent, lastPositionSeconds });
    if (progressPercent >= 90) this.completed.add(lessonId);
  }
  async markEnrollmentCompleted() { this.enrollment.status = 'COMPLETED'; this.completedEnrollment = true; }
}

test('reported video progress is capped by credible server-side elapsed watch time', async () => {
  const repo = new Repo();
  const service = new VideoProgressService(repo, {
    now: () => new Date('2026-08-30T14:00:30.000Z'),
  });

  const result = await service.reportProgress({
    grantId: 'grant-1',
    studentId: 'student-1',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    reportedPercent: 100,
    lastPositionSeconds: 100,
  });

  assert.deepEqual(result, {
    ok: true,
    lessonCompleted: false,
    creditedPercent: 30,
    courseProgressPercent: 0,
    courseCompleted: false,
    nextLessonId: null,
  });
  assert.equal(repo.savedProgress[0].progressPercent, 30);
  assert.equal(repo.completed.has('lesson-1'), false);
});

test('video reaches completion only when reported and credible elapsed progress both reach threshold', async () => {
  const repo = new Repo();
  const service = new VideoProgressService(repo, {
    now: () => new Date('2026-08-30T14:01:35.000Z'),
  });

  const result = await service.reportProgress({
    grantId: 'grant-1',
    studentId: 'student-1',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    reportedPercent: 95,
    lastPositionSeconds: 95,
  });

  assert.deepEqual(result, {
    ok: true,
    lessonCompleted: true,
    creditedPercent: 95,
    courseProgressPercent: 50,
    courseCompleted: false,
    nextLessonId: 'lesson-2',
  });
  assert.equal(repo.completed.has('lesson-1'), true);
});

test('expired or unknown playback grant cannot advance progress', async () => {
  const repo = new Repo();
  const expiredService = new VideoProgressService(repo, {
    now: () => new Date('2026-08-30T15:00:01.000Z'),
  });

  const expired = await expiredService.reportProgress({
    grantId: 'grant-1', studentId: 'student-1', courseId: 'course-1', lessonId: 'lesson-1',
    reportedPercent: 100, lastPositionSeconds: 100,
  });
  const unknown = await expiredService.reportProgress({
    grantId: 'missing', studentId: 'student-1', courseId: 'course-1', lessonId: 'lesson-1',
    reportedPercent: 100, lastPositionSeconds: 100,
  });

  assert.deepEqual(expired, { ok: false, reason: 'PLAYBACK_GRANT_INVALID' });
  assert.deepEqual(unknown, { ok: false, reason: 'PLAYBACK_GRANT_INVALID' });
  assert.equal(repo.savedProgress.length, 0);
});

test('media progress cannot bypass sequential locking or complete manual lessons', async () => {
  const repo = new Repo({ completed: ['lesson-1'] });
  const service = new VideoProgressService(repo, {
    now: () => new Date('2026-08-30T14:01:35.000Z'),
  });

  repo.getPlaybackGrant = async () => ({
    id: 'grant-2', studentId: 'student-1', courseId: 'course-1', lessonId: 'lesson-2',
    startedAt: new Date('2026-08-30T14:00:00.000Z'),
    expiresAt: new Date('2026-08-30T15:00:00.000Z'), revokedAt: null,
  });

  const result = await service.reportProgress({
    grantId: 'grant-2', studentId: 'student-1', courseId: 'course-1', lessonId: 'lesson-2',
    reportedPercent: 100, lastPositionSeconds: 10,
  });

  assert.deepEqual(result, { ok: false, reason: 'VIDEO_PROGRESS_NOT_ALLOWED' });
});
