import test from 'node:test';
import assert from 'node:assert/strict';

import { LiveRoomService } from '../src/features/live-classes/services/live-room.service.ts';

class FakeLiveRepository {
  constructor() {
    this.active = 0;
    this.own = [];
    this.all = [];
  }

  async upsertViewerHeartbeat() {
    return { id: 'viewer-1' };
  }

  async countActiveViewers() {
    return this.active;
  }

  async listViewerMessages() {
    return this.own;
  }

  async listAdminAttendeeMessages() {
    return this.all;
  }
}

test('heartbeat returns viewer display count using admin baseline mode while keeping measured active viewers separate', async () => {
  const repository = new FakeLiveRepository();
  repository.active = 37;
  const service = new LiveRoomService(repository);

  const result = await service.heartbeat({
    batchId: 'batch-1',
    sessionId: 'session-1',
    viewerTokenHash: 'hash-1',
    viewerDisplayMode: 'CONFIGURED_BASELINE',
    expectedViewerBaseline: 500,
  });

  assert.equal(result.activeViewers, 37);
  assert.equal(result.displayViewerCount, 500);
});

test('public attendee message view contains staged timeline plus only that viewer own real messages', async () => {
  const repository = new FakeLiveRepository();
  repository.own = [
    { id: 'mine-1', displayName: 'Me', message: 'My question', createdAt: new Date('2026-08-30T19:10:00Z') },
  ];
  repository.all = [
    ...repository.own,
    { id: 'other-1', displayName: 'Other', message: 'Private other question', createdAt: new Date('2026-08-30T19:11:00Z') },
  ];
  const service = new LiveRoomService(repository);

  const result = await service.getPublicChat({
    viewerId: 'viewer-1',
    liveOffsetSeconds: 75,
    stagedMessages: [
      { id: 'staged-1', offsetSeconds: 30, displayName: 'Ada', message: 'Welcome', position: 1 },
      { id: 'staged-2', offsetSeconds: 90, displayName: 'John', message: 'Future message', position: 2 },
    ],
  });

  assert.deepEqual(result.staged.map((item) => item.id), ['staged-1']);
  assert.deepEqual(result.own.map((item) => item.id), ['mine-1']);
  assert.equal(result.own.some((item) => item.id === 'other-1'), false);
});

test('admin attendee inbox can see all real attendee comments for moderation and response context', async () => {
  const repository = new FakeLiveRepository();
  repository.all = [
    { id: 'm1', displayName: 'A', message: 'Question A', createdAt: new Date() },
    { id: 'm2', displayName: 'B', message: 'Question B', createdAt: new Date() },
  ];
  const service = new LiveRoomService(repository);

  const result = await service.getAdminAttendeeMessages({ batchId: 'batch-1', sessionId: 'session-1' });
  assert.deepEqual(result.map((item) => item.id), ['m1', 'm2']);
});
