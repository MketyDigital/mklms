import test from 'node:test';
import assert from 'node:assert/strict';

import { LiveAttendeeMessageService } from '../src/features/live-classes/services/live-attendee-message.service.ts';

class FakeRepository {
  constructor() { this.created = []; }
  async createAttendeeMessage(input) {
    const record = { id: 'message-1', sessionId: input.sessionId, displayName: input.displayName, message: input.message, createdAt: new Date() };
    this.created.push(record);
    return record;
  }
}

class FakeNotifier {
  constructor({ fail = false } = {}) { this.fail = fail; this.sent = []; }
  async notify(input) {
    this.sent.push(input);
    if (this.fail) throw new Error('telegram unavailable');
  }
}

test('attendee comment is persisted with its live session before optional notification is dispatched', async () => {
  const repository = new FakeRepository();
  const notifier = new FakeNotifier();
  const service = new LiveAttendeeMessageService(repository, notifier);

  const result = await service.send({
    batchId: 'batch-1', sessionId: 'session-1', viewerId: 'viewer-1',
    displayName: 'Ada', message: 'Please explain that again', batchTitle: 'Free Class', sessionTitle: 'Day 1',
  });

  assert.equal(result.ok, true);
  assert.equal(result.message.sessionId, 'session-1');
  assert.equal(result.notificationDelivered, true);
  assert.equal(repository.created.length, 1);
  assert.equal(notifier.sent.length, 1);
  assert.match(notifier.sent[0].message, /Ada/);
  assert.match(notifier.sent[0].message, /Please explain/);
});

test('notification failure never rolls back or hides a successfully persisted attendee comment', async () => {
  const repository = new FakeRepository();
  const notifier = new FakeNotifier({ fail: true });
  const service = new LiveAttendeeMessageService(repository, notifier);

  const result = await service.send({
    batchId: 'batch-1', sessionId: 'session-1', viewerId: 'viewer-1',
    displayName: 'Ada', message: 'I have a question', batchTitle: 'Free Class', sessionTitle: 'Day 1',
  });

  assert.equal(result.ok, true);
  assert.equal(result.notificationDelivered, false);
  assert.equal(result.message.id, 'message-1');
  assert.equal(result.message.sessionId, 'session-1');
  assert.equal(repository.created.length, 1);
});

test('blank attendee comments are rejected before persistence', async () => {
  const repository = new FakeRepository();
  const service = new LiveAttendeeMessageService(repository, null);
  await assert.rejects(
    () => service.send({ batchId: 'b', sessionId: 's', viewerId: 'v', displayName: 'Ada', message: '   ', batchTitle: 'Class', sessionTitle: 'Day 1' }),
    /message is required/i,
  );
  assert.equal(repository.created.length, 0);
});
