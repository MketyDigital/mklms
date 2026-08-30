import test from 'node:test';
import assert from 'node:assert/strict';

import { MediaPlaybackService } from '../src/features/media/services/media-playback.service.ts';

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
      { id: 'lesson-1', moduleId: 'module-1', title: 'Lesson 1', position: 1, status: 'PUBLISHED', mediaAssetId: 'media-1', completionMode: 'VIDEO_PROGRESS', completionThresholdPercent: 90 },
      { id: 'lesson-2', moduleId: 'module-1', title: 'Lesson 2', position: 2, status: 'PUBLISHED', mediaAssetId: 'media-2', completionMode: 'VIDEO_PROGRESS', completionThresholdPercent: 90 },
    ],
  }],
};

class Repo {
  constructor({ completed = [], enrollmentStatus = 'ACTIVE', sourceType = 'HLS' } = {}) {
    this.completed = new Set(completed);
    this.enrollmentStatus = enrollmentStatus;
    this.sourceType = sourceType;
  }
  async getCourseStructure(courseId) { return courseId === 'course-1' ? course : null; }
  async getEnrollment(studentId, courseId) {
    return studentId === 'student-1' && courseId === 'course-1'
      ? { studentId, courseId, status: this.enrollmentStatus }
      : null;
  }
  async getCompletedLessonIds() { return new Set(this.completed); }
  async getMediaAssetForLesson(_courseId, lessonId) {
    const id = lessonId === 'lesson-1' ? 'media-1' : lessonId === 'lesson-2' ? 'media-2' : null;
    return id ? { id, sourceType: this.sourceType, providerAssetId: `provider-${id}`, status: 'READY' } : null;
  }
}

class Provider {
  constructor() { this.calls = []; }
  async createPlaybackAuthorization(asset, context) {
    this.calls.push({ asset, context });
    return {
      playbackType: asset.sourceType === 'HLS' ? 'HLS' : 'DIRECT',
      url: `https://cdn.example.test/play/${asset.id}?token=short-lived`,
      expiresAt: new Date(context.now.getTime() + context.ttlSeconds * 1000),
    };
  }
}

test('accessible protectable lesson receives short-lived playback authorization', async () => {
  const provider = new Provider();
  const now = new Date('2026-08-30T12:00:00.000Z');
  const service = new MediaPlaybackService(new Repo(), provider, { now: () => now, ttlSeconds: 300 });

  const result = await service.authorizeLessonPlayback('student-1', 'course-1', 'lesson-1');

  assert.equal(result.ok, true);
  assert.equal(result.authorization.playbackType, 'HLS');
  assert.equal(result.authorization.expiresAt.toISOString(), '2026-08-30T12:05:00.000Z');
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].context.studentId, 'student-1');
});

test('playback authorization cannot outlive the authenticated student session', async () => {
  const provider = new Provider();
  const now = new Date('2026-08-30T12:00:00.000Z');
  const service = new MediaPlaybackService(new Repo(), provider, { now: () => now, ttlSeconds: 300 });

  const result = await service.authorizeLessonPlayback(
    'student-1',
    'course-1',
    'lesson-1',
    new Date('2026-08-30T12:01:30.000Z'),
  );

  assert.equal(result.ok, true);
  assert.equal(provider.calls[0].context.ttlSeconds, 90);
  assert.equal(result.authorization.expiresAt.toISOString(), '2026-08-30T12:01:30.000Z');
});

test('expired student session never reaches the media provider', async () => {
  const provider = new Provider();
  const now = new Date('2026-08-30T12:00:00.000Z');
  const service = new MediaPlaybackService(new Repo(), provider, { now: () => now });

  const result = await service.authorizeLessonPlayback(
    'student-1',
    'course-1',
    'lesson-1',
    new Date('2026-08-30T12:00:00.000Z'),
  );

  assert.deepEqual(result, { ok: false, reason: 'SESSION_EXPIRED' });
  assert.equal(provider.calls.length, 0);
});

test('locked sequential lesson never reaches the media provider', async () => {
  const provider = new Provider();
  const service = new MediaPlaybackService(new Repo(), provider);

  const result = await service.authorizeLessonPlayback('student-1', 'course-1', 'lesson-2');

  assert.deepEqual(result, { ok: false, reason: 'LESSON_LOCKED' });
  assert.equal(provider.calls.length, 0);
});

test('inactive enrollment never receives playback authorization', async () => {
  const provider = new Provider();
  const service = new MediaPlaybackService(new Repo({ enrollmentStatus: 'SUSPENDED' }), provider);

  const result = await service.authorizeLessonPlayback('student-1', 'course-1', 'lesson-1');

  assert.deepEqual(result, { ok: false, reason: 'ENROLLMENT_INACTIVE' });
  assert.equal(provider.calls.length, 0);
});

test('public external embeds are returned without pretending they have private-origin protection', async () => {
  const provider = new Provider();
  const repo = new Repo({ sourceType: 'EXTERNAL_EMBED' });
  repo.getMediaAssetForLesson = async () => ({
    id: 'media-1', sourceType: 'EXTERNAL_EMBED', providerAssetId: 'https://video.example.test/embed/abc', status: 'READY',
  });
  const service = new MediaPlaybackService(repo, provider);

  const result = await service.authorizeLessonPlayback('student-1', 'course-1', 'lesson-1');

  assert.deepEqual(result, {
    ok: true,
    authorization: {
      playbackType: 'EMBED',
      url: 'https://video.example.test/embed/abc',
      expiresAt: null,
      protection: 'PUBLIC_SOURCE',
    },
  });
  assert.equal(provider.calls.length, 0);
});
