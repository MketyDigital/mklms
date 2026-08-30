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
      playbackType: 'HLS',
      url: 'https://delivery.example/signed.m3u8',
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
  assert.equal(result.authorization?.playbackType, 'HLS');
  assert.equal(media.calls[0].context.viewerId, 'viewer-1');
  assert.equal(media.calls[0].context.studentId, null);
});

test('ended class receives no playback authorization', async () => {
  const media = new FakeMediaProvider();
  const service = new LivePlaybackService(new FakeRepository(), media);
  const result = await service.authorize({ batch, viewerId: 'viewer-1', now: new Date('2026-08-30T20:30:00Z') });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'ENDED');
  assert.equal(media.calls.length, 0);
});

test('live session without a ready configured media asset fails closed', async () => {
  const noMediaBatch = { ...batch, sessions: [{ ...batch.sessions[0], mediaAssetId: null }] };
  const media = new FakeMediaProvider();
  const service = new LivePlaybackService(new FakeRepository(), media);
  const result = await service.authorize({ batch: noMediaBatch, viewerId: 'viewer-1', now: new Date('2026-08-30T19:10:00Z') });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'MEDIA_UNAVAILABLE');
  assert.equal(media.calls.length, 0);
});
