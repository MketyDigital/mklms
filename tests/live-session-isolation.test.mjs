import assert from 'node:assert/strict';
import test from 'node:test';

import { getInitialTimelineMessages } from '../src/features/live-classes/domain/live-timeline.ts';
import { ownLiveCommentStorageKey } from '../src/features/live-classes/domain/live-client-cache.ts';
import { LiveRoomService } from '../src/features/live-classes/services/live-room.service.ts';

class Repo {
  constructor(messages = []) { this.messages = messages; }
  async listViewerMessages(viewerId, sessionId) {
    return this.messages.filter((item) => item.viewerId === viewerId && item.sessionId === sessionId);
  }
  async listAdminAttendeeMessages() { return []; }
  async findViewerByTokenHash() { return { id: 'viewer-1' }; }
  async upsertViewerHeartbeat() { return { id: 'viewer-1' }; }
  async countActiveViewers() { return 1; }
}

test('viewer local comment cache key is scoped by live session, not only class slug', () => {
  assert.notEqual(
    ownLiveCommentStorageKey('free-class', 'session-1'),
    ownLiveCommentStorageKey('free-class', 'session-2'),
  );
});

test('server own comments returned to public live room are restricted to active session', async () => {
  const service = new LiveRoomService(new Repo([
    { id: 'm1', viewerId: 'viewer-1', sessionId: 'session-1', message: 'Day one', createdAt: new Date() },
    { id: 'm2', viewerId: 'viewer-1', sessionId: 'session-2', message: 'Day two', createdAt: new Date() },
  ]));
  const chat = await service.getPublicChat({
    viewerId: 'viewer-1',
    sessionId: 'session-2',
    liveOffsetSeconds: 10,
    stagedMessages: [],
  });
  assert.deepEqual(chat.own.map((item) => item.id), ['m2']);
});

test('uploaded staged chat reveals only messages reached by the current session video offset', () => {
  const staged = [
    { id: 'a', offsetSeconds: 0, displayName: 'Mary', message: 'Welcome', position: 1 },
    { id: 'b', offsetSeconds: 90, displayName: 'Sam', message: 'I can hear you', position: 2 },
  ];
  assert.deepEqual(getInitialTimelineMessages(staged, 0, 20).map((item) => item.id), ['a']);
  assert.deepEqual(getInitialTimelineMessages(staged, 89, 20).map((item) => item.id), ['a']);
  assert.deepEqual(getInitialTimelineMessages(staged, 90, 20).map((item) => item.id), ['a', 'b']);
});
