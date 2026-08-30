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
    id: 'module-1', courseId: 'course-1', title: 'Module One', position: 1,
    lessons: [{
      id: 'lesson-1', moduleId: 'module-1', title: 'Lesson 1', position: 1,
      status: 'PUBLISHED', mediaAssetId: 'media-1', completionMode: 'VIDEO_PROGRESS', completionThresholdPercent: 90,
    }],
  }],
};

class Repo {
  async getCourseStructure() { return course; }
  async getEnrollment(studentId, courseId) { return { studentId, courseId, status: 'ACTIVE' }; }
  async getCompletedLessonIds() { return new Set(); }
  async getMediaAssetForLesson() { return { id: 'media-1', sourceType: 'HLS', providerAssetId: 'private-media-1', status: 'READY' }; }
}

class Provider {
  constructor() { this.calls = []; }
  async createPlaybackAuthorization(asset, context) {
    this.calls.push({ asset, context });
    return {
      playbackType: 'HLS',
      url: 'https://cdn.example.test/private/master.m3u8?token=short-lived',
      expiresAt: new Date(context.now.getTime() + context.ttlSeconds * 1000),
    };
  }
}

test('private playback TTL is capped by authenticated student session remaining lifetime', async () => {
  const now = new Date('2026-08-30T14:00:00.000Z');
  const sessionExpiresAt = new Date('2026-08-30T14:02:00.000Z');
  const provider = new Provider();
  const service = new MediaPlaybackService(new Repo(), provider, { now: () => now, ttlSeconds: 300 });

  const result = await service.authorizeLessonPlayback('student-1', 'course-1', 'lesson-1', { sessionExpiresAt });

  assert.equal(result.ok, true);
  assert.equal(provider.calls[0].context.ttlSeconds, 120);
  assert.equal(result.authorization.expiresAt.toISOString(), sessionExpiresAt.toISOString());
});

test('expired student session never receives private playback authorization', async () => {
  const now = new Date('2026-08-30T14:00:00.000Z');
  const provider = new Provider();
  const service = new MediaPlaybackService(new Repo(), provider, { now: () => now, ttlSeconds: 300 });

  const result = await service.authorizeLessonPlayback('student-1', 'course-1', 'lesson-1', {
    sessionExpiresAt: new Date('2026-08-30T13:59:59.000Z'),
  });

  assert.deepEqual(result, { ok: false, reason: 'SESSION_EXPIRED' });
  assert.equal(provider.calls.length, 0);
});
