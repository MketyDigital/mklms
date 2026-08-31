import test from 'node:test';
import assert from 'node:assert/strict';

import { LivePlaybackService } from '../src/features/live-classes/services/live-playback.service.ts';

const batch = {
  id: 'batch-1',
  slug: 'class',
  status: 'ACTIVE',
  sessions: [
    {
      id: 'session-1', batchId: 'batch-1', title: 'Day 1', position: 1,
      startsAt: new Date('2026-08-30T19:00:00Z'), durationSeconds: 3600,
      status: 'PUBLISHED', mediaAssetId: 'asset-1',
    },
  ],
};

class FakeRepository {
  async getMediaAsset(id) {
    return id === 'asset-1'
      ? { id, sourceType: 'HLS', providerAssetId: 'private/master.m3u8', status: 'READY' }
      : null;
  }
}

class FakeMediaProvider {
  constructor() { this.calls = []; }
  async createPlaybackAuthorization(asset, context) {
    this.calls.push({ asset, context });
    return {
      playbackType: asset.sourceType === 'DIRECT' ? 'DIRECT' : 'HLS',
      url: asset.sourceType === 'DIRECT'
        ? 'https://delivery.example/signed.mp4'
        : 'https://delivery.example/signed.m3u8',
      expiresAt: new Date(context.now.getTime() + context.ttlSeconds * 1000),
      protection: 'PRIVATE_AUTHORIZATION',
    };
  }
}

test('upcoming live class receives no playback authorization', async () => {
  const media = new FakeMediaProvider();
  const service = new LivePlaybackService(new FakeRepository(), media);
  const result = await service.authorize({ batch, viewerId: 'viewer-1', now: new Date('2026-08-30T18:59:00Z') });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'UPCOMING');
  assert.equal(media.calls.length, 0);
});

test('active session receives viewer-scoped authorization and server-derived start offset', async () => {
  const media = new FakeMediaProvider();
  const service = new LivePlaybackService(new FakeRepository(), media);
  const result = await service.authorize({ batch, viewerId: 'viewer-1', now: new Date('2026-08-30T19:23:40Z') });
  assert.equal(result.ok, true);
  assert.equal(result.state, 'LIVE');
  assert.equal(result.sessionId, 'session-1');
  assert.equal(result.startAtSeconds, 1420);
  assert.equal(result.testMode, false);
  assert.equal(result.authorization?.playbackType, 'HLS');
  assert.equal(media.calls[0].context.viewerId, 'viewer-1');
  assert.equal(media.calls[0].context.studentId, null);
  assert.equal(media.calls[0].context.courseId, null);
  assert.equal(media.calls[0].context.lessonId, null);
});

test('live authorization expires no later than the scheduled session end', async () => {
  const media = new FakeMediaProvider();
  const directRepository = {
    async getMediaAsset(id) {
      return id === 'asset-1'
        ? { id, sourceType: 'DIRECT', providerAssetId: 'media/live/day-01.mp4', status: 'READY' }
        : null;
    },
  };
  const service = new LivePlaybackService(directRepository, media, { ttlSeconds: 180 });
  const now = new Date('2026-08-30T19:59:50Z');
  const result = await service.authorize({ batch, viewerId: 'viewer-free', now });

  assert.equal(result.ok, true);
  assert.equal(result.authorization?.playbackType, 'DIRECT');
  assert.equal(media.calls.length, 1);
  assert.equal(media.calls[0].context.ttlSeconds, 10);
  assert.equal(result.authorization?.expiresAt?.toISOString(), '2026-08-30T20:00:00.000Z');
});

test('ended class receives no playback authorization', async () => {
  const media = new FakeMediaProvider();
  const service = new LivePlaybackService(new FakeRepository(), media);
  const result = await service.authorize({ batch, viewerId: 'viewer-1', now: new Date('2026-08-30T20:30:00Z') });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'ENDED');
  assert.equal(media.calls.length, 0);
});

test('active session with no media enters explicit live test mode without contacting media provider', async () => {
  const noMediaBatch = { ...batch, sessions: [{ ...batch.sessions[0], mediaAssetId: null }] };
  const media = new FakeMediaProvider();
  const service = new LivePlaybackService(new FakeRepository(), media);
  const result = await service.authorize({ batch: noMediaBatch, viewerId: 'viewer-1', now: new Date('2026-08-30T19:10:00Z') });
  assert.equal(result.ok, true);
  assert.equal(result.testMode, true);
  assert.equal(result.authorization, null);
  assert.equal(result.sessionId, 'session-1');
  assert.equal(result.startAtSeconds, 600);
  assert.equal(media.calls.length, 0);
});

test('configured media that is missing or not ready still fails closed', async () => {
  const missingBatch = { ...batch, sessions: [{ ...batch.sessions[0], mediaAssetId: 'missing-asset' }] };
  const media = new FakeMediaProvider();
  const service = new LivePlaybackService(new FakeRepository(), media);
  const result = await service.authorize({ batch: missingBatch, viewerId: 'viewer-1', now: new Date('2026-08-30T19:10:00Z') });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'MEDIA_UNAVAILABLE');
  assert.equal(media.calls.length, 0);
});
