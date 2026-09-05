import test from 'node:test';
import assert from 'node:assert/strict';

import { AdminLiveClassService } from '../src/features/live-classes/services/admin-live-class.service.ts';

class FakeRepository {
  constructor() { this.batches = []; this.sessions = []; this.timeline = []; }
  async createBatch(input) { const record = { id: `batch-${this.batches.length + 1}`, ...input }; this.batches.push(record); return record; }
  async findBatchById(batchId) { return this.batches.find((item) => item.id === batchId) ?? null; }
  async updateBatch(batchId, input) { const index = this.batches.findIndex((item) => item.id === batchId); if (index < 0) throw new Error('Live class not found.'); this.batches[index] = { ...this.batches[index], ...input }; }
  async createSession(batchId, input) { const record = { id: `session-${this.sessions.length + 1}`, batchId, ...input }; this.sessions.push(record); return record; }
  async findSessionById(sessionId) { return this.sessions.find((item) => item.id === sessionId) ?? null; }
  async replaceTimelineMessages(sessionId, items) { this.timeline = items.map((item, index) => ({ id: `chat-${index + 1}`, sessionId, position: index + 1, ...item })); return this.timeline; }
  async getTimelineSummary(sessionId) {
    const items = this.timeline.filter((item) => item.sessionId === sessionId);
    return {
      count: items.length,
      firstOffsetSeconds: items[0]?.offsetSeconds ?? null,
      lastOffsetSeconds: items.at(-1)?.offsetSeconds ?? null,
    };
  }
  async setBatchStatus(id, status) { const batch = this.batches.find((item) => item.id === id); if (batch) batch.status = status; }
}

test('admin creates a reusable batch with normalized slug and configured viewer display', async () => {
  const repository = new FakeRepository();
  const service = new AdminLiveClassService(repository);
  const batch = await service.createBatch({ title: 'August Free Class', slug: ' August FREE Class ', expectedViewerBaseline: 1800, viewerDisplayMode: 'CONFIGURED_BASELINE', endedMessage: 'This class has ended.', endedRedirectUrl: 'https://example.com/next' });
  assert.equal(batch.slug, 'august-free-class');
  assert.equal(batch.expectedViewerBaseline, 1800);
  assert.equal(batch.status, 'DRAFT');
});

test('editing an existing free live class preserves its public viewer-comment setting when the legacy form omits it', async () => {
  const repository = new FakeRepository();
  repository.batches.push({
    id: 'batch-1', slug: 'free-class', title: 'Free Class', description: null, status: 'ACTIVE',
    expectedViewerBaseline: 500, viewerDisplayMode: 'CONFIGURED_BASELINE', attendeeChatVisibility: 'PUBLIC',
    endedMessage: null, endedRedirectUrl: null, notificationDestination: null,
  });
  const service = new AdminLiveClassService(repository);

  await service.updateBatch('batch-1', {
    title: 'Updated Free Class', slug: 'free-class', expectedViewerBaseline: 500,
    viewerDisplayMode: 'CONFIGURED_BASELINE',
  });

  assert.equal(repository.batches[0].title, 'Updated Free Class');
  assert.equal(repository.batches[0].attendeeChatVisibility, 'PUBLIC');
});

test('admin can add up to three ordered sessions with media, CTA and expiry behavior', async () => {
  const repository = new FakeRepository();
  const service = new AdminLiveClassService(repository);
  for (let position = 1; position <= 3; position += 1) {
    await service.createSession('batch-1', { title: `Day ${position}`, position, startsAt: new Date(`2026-09-0${position}T19:00:00Z`), durationSeconds: 3600, mediaAssetId: `asset-${position}`, ctaText: 'Continue', ctaUrl: 'https://example.com/offer', ctaRevealOffsetSeconds: 1200, endedMessage: 'Session complete' });
  }
  assert.equal(repository.sessions.length, 3);
  await assert.rejects(() => service.createSession('batch-1', { title: 'Day 4', position: 4, startsAt: new Date(), durationSeconds: 3600, mediaAssetId: 'asset-4' }), /1 and 3/i);
});

test('viewer baseline cannot be negative and session duration must be positive', async () => {
  const service = new AdminLiveClassService(new FakeRepository());
  await assert.rejects(() => service.createBatch({ title: 'Class', expectedViewerBaseline: -1, viewerDisplayMode: 'ACTIVE_ONLY' }), /viewer baseline/i);
  await assert.rejects(() => service.createSession('batch-1', { title: 'Day 1', position: 1, startsAt: new Date(), durationSeconds: 0, mediaAssetId: 'asset' }), /duration/i);
});

test('admin imports normalized staged chat and confirms the number actually stored', async () => {
  const repository = new FakeRepository();
  repository.sessions.push({ id: 'session-1', batchId: 'batch-1', durationSeconds: 3600 });
  const service = new AdminLiveClassService(repository);
  const good = await service.importTimeline('session-1', { format: 'csv', content: 'offset_seconds,display_name,message\n5,Ada,Welcome\n30,John,Ready' });
  assert.equal(good.imported, 2);
  assert.equal(good.stored, 2);
  assert.deepEqual(good.summary, { count: 2, firstOffsetSeconds: 5, lastOffsetSeconds: 30 });
  assert.equal(repository.timeline.length, 2);
  const bad = await service.importTimeline('session-1', { format: 'text', content: 'not valid' });
  assert.equal(bad.imported, 0);
  assert.equal(bad.errors.length, 1);
  assert.equal(repository.timeline.length, 2);
});

test('Zoom wall-clock chat is rebased against the selected session even for morning classes', async () => {
  const repository = new FakeRepository();
  repository.sessions.push({ id: 'session-1', batchId: 'batch-1', durationSeconds: 3600 });
  const service = new AdminLiveClassService(repository);
  const result = await service.importTimeline('session-1', {
    format: 'text',
    content: '08:03:15 From Mary to Everyone: Good morning\n08:08:15 From Sam to Everyone: I can hear you',
  });
  assert.equal(result.imported, 2);
  assert.deepEqual(repository.timeline.map((item) => item.offsetSeconds), [0, 300]);
  assert.equal(result.errors.length, 0);
});

test('operator can calibrate first imported Zoom message to a known video time', async () => {
  const repository = new FakeRepository();
  repository.sessions.push({ id: 'session-1', batchId: 'batch-1', durationSeconds: 3600 });
  const service = new AdminLiveClassService(repository);
  const result = await service.importTimeline('session-1', {
    format: 'text',
    content: '20:03:15 From Mary to Everyone: Good evening\n20:04:45 From Sam to Everyone: I can hear you',
    firstMessageAtSeconds: 600,
  });
  assert.equal(result.imported, 2);
  assert.deepEqual(repository.timeline.map((item) => item.offsetSeconds), [600, 690]);
  assert.deepEqual(result.summary, { count: 2, firstOffsetSeconds: 600, lastOffsetSeconds: 690 });
});

test('impossible non-Zoom offsets are rejected instead of silently importing invisible chat', async () => {
  const repository = new FakeRepository();
  repository.sessions.push({ id: 'session-1', batchId: 'batch-1', durationSeconds: 3600 });
  const service = new AdminLiveClassService(repository);
  const result = await service.importTimeline('session-1', {
    format: 'csv',
    content: 'offset_seconds,display_name,message\n7200,Ada,Too late',
  });
  assert.equal(result.imported, 0);
  assert.match(result.errors[0].message, /session duration/i);
  assert.equal(repository.timeline.length, 0);
});

test('activating a batch is explicit and independent of any registration or payment system', async () => {
  const repository = new FakeRepository();
  const service = new AdminLiveClassService(repository);
  await service.setBatchStatus('batch-1', 'ACTIVE');
  assert.equal(repository.batches.length, 0);
});

test('quick test creates an active published session that is live immediately without media', async () => {
  const repository = new FakeRepository();
  const service = new AdminLiveClassService(repository);
  const now = new Date('2026-08-30T21:30:00Z');
  const result = await service.createQuickTest({ title: 'Live room test', expectedViewerBaseline: 250, now });
  assert.equal(result.batch.status, 'ACTIVE');
  assert.equal(result.session.status, 'PUBLISHED');
  assert.equal(result.session.mediaAssetId, null);
  assert.ok(result.session.startsAt.getTime() <= now.getTime());
  assert.equal(result.session.durationSeconds, 15 * 60);
});
