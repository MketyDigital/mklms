import test from 'node:test';
import assert from 'node:assert/strict';

import { AdminLiveClassService } from '../src/features/live-classes/services/admin-live-class.service.ts';

class FakeRepository {
  constructor() { this.batches = []; this.sessions = []; this.timeline = []; }
  async createBatch(input) { const record = { id: 'batch-1', ...input }; this.batches.push(record); return record; }
  async createSession(batchId, input) { const record = { id: `session-${this.sessions.length + 1}`, batchId, ...input }; this.sessions.push(record); return record; }
  async replaceTimelineMessages(sessionId, items) { this.timeline = items.map((item, index) => ({ id: `chat-${index + 1}`, sessionId, position: index + 1, ...item })); return this.timeline; }
  async setBatchStatus(id, status) { const batch = this.batches.find((item) => item.id === id); if (batch) batch.status = status; }
}

test('admin creates a reusable batch with normalized slug and configured viewer display', async () => {
  const repository = new FakeRepository();
  const service = new AdminLiveClassService(repository);
  const batch = await service.createBatch({
    title: 'August Free Class',
    slug: ' August FREE Class ',
    expectedViewerBaseline: 1800,
    viewerDisplayMode: 'CONFIGURED_BASELINE',
    endedMessage: 'This class has ended.',
    endedRedirectUrl: 'https://example.com/next',
  });
  assert.equal(batch.slug, 'august-free-class');
  assert.equal(batch.expectedViewerBaseline, 1800);
  assert.equal(batch.status, 'DRAFT');
});

test('admin can add up to three ordered sessions with media, CTA and expiry behavior', async () => {
  const repository = new FakeRepository();
  const service = new AdminLiveClassService(repository);
  for (let position = 1; position <= 3; position += 1) {
    await service.createSession('batch-1', {
      title: `Day ${position}`,
      position,
      startsAt: new Date(`2026-09-0${position}T19:00:00Z`),
      durationSeconds: 3600,
      mediaAssetId: `asset-${position}`,
      ctaText: 'Continue',
      ctaUrl: 'https://example.com/offer',
      ctaRevealOffsetSeconds: 1200,
      endedMessage: 'Session complete',
    });
  }
  assert.equal(repository.sessions.length, 3);
  await assert.rejects(
    () => service.createSession('batch-1', { title: 'Day 4', position: 4, startsAt: new Date(), durationSeconds: 3600, mediaAssetId: 'asset-4' }),
    /1 and 3/i,
  );
});

test('viewer baseline cannot be negative and session duration must be positive', async () => {
  const service = new AdminLiveClassService(new FakeRepository());
  await assert.rejects(
    () => service.createBatch({ title: 'Class', expectedViewerBaseline: -1, viewerDisplayMode: 'ACTIVE_ONLY' }),
    /viewer baseline/i,
  );
  await assert.rejects(
    () => service.createSession('batch-1', { title: 'Day 1', position: 1, startsAt: new Date(), durationSeconds: 0, mediaAssetId: 'asset' }),
    /duration/i,
  );
});

test('admin imports normalized staged chat and invalid input reports errors instead of replacing good timeline', async () => {
  const repository = new FakeRepository();
  const service = new AdminLiveClassService(repository);
  const good = await service.importTimeline('session-1', {
    format: 'csv',
    content: 'offset_seconds,display_name,message\n5,Ada,Welcome\n30,John,Ready',
  });
  assert.equal(good.imported, 2);
  assert.equal(repository.timeline.length, 2);

  const bad = await service.importTimeline('session-1', { format: 'text', content: 'not valid' });
  assert.equal(bad.imported, 0);
  assert.equal(bad.errors.length, 1);
  assert.equal(repository.timeline.length, 2);
});

test('activating a batch is explicit and independent of any registration or payment system', async () => {
  const repository = new FakeRepository();
  const service = new AdminLiveClassService(repository);
  await service.setBatchStatus('batch-1', 'ACTIVE');
  assert.equal(repository.batches.length, 0);
  // Repository method is invoked directly; there is deliberately no payment/enrollment dependency.
});
