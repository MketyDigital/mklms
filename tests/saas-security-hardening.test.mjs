import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const protectedRoutes = [
  ['src/app/api/access/login/route.ts', 'AUTH_RATE_LIMITER'],
  ['src/app/api/access/claim/route.ts', 'AUTH_RATE_LIMITER'],
  ['src/app/api/admin/session/login/route.ts', 'AUTH_RATE_LIMITER'],
  ['src/app/api/admin/media/direct-upload/initiate/route.ts', 'ADMIN_RATE_LIMITER'],
  ['src/app/api/admin/media/direct-upload/finalize/route.ts', 'ADMIN_RATE_LIMITER'],
  ['src/app/api/admin/media/upload/route.ts', 'ADMIN_RATE_LIMITER'],
  ['src/app/api/courses/[courseId]/quizzes/[quizId]/attempt/route.ts', 'STUDENT_MUTATION_RATE_LIMITER'],
  ['src/app/api/courses/[courseId]/lessons/[lessonId]/complete/route.ts', 'STUDENT_MUTATION_RATE_LIMITER'],
  ['src/app/api/courses/[courseId]/lessons/[lessonId]/progress/route.ts', 'STUDENT_MUTATION_RATE_LIMITER'],
  ['src/app/api/messages/route.ts', 'STUDENT_MUTATION_RATE_LIMITER'],
  ['src/app/api/courses/[courseId]/lessons/[lessonId]/playback/route.ts', 'PLAYBACK_RATE_LIMITER'],
  ['src/app/api/courses/[courseId]/paid-live/[sessionId]/join/route.ts', 'PLAYBACK_RATE_LIMITER'],
  ['src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts', 'PLAYBACK_RATE_LIMITER'],
  ['src/app/api/admin/certificates/[certificateId]/action/route.ts', 'CERT_RATE_LIMITER'],
];

test('sensitive endpoints use the intended distributed rate limit binding', () => {
  for (const [path, binding] of protectedRoutes) {
    const source = read(path);
    assert.match(source, /consumeDistributedRateLimit/,
      `${path} must use the distributed limiter`);
    assert.ok(source.includes(binding), `${path} must use ${binding}`);
    assert.match(source, /status:\s*429/,
      `${path} must return HTTP 429 when rate limited`);
  }
});

test('access claim keeps a local auth limiter before the distributed limiter', () => {
  const source = read('src/app/api/access/claim/route.ts');
  assert.match(source, /FixedWindowRateLimiter/);
  assert.match(source, /new FixedWindowRateLimiter\(\{\s*limit:\s*10,\s*windowMs:\s*10 \* 60_000\s*\}\)/);
  const localConsume = source.indexOf('limiter.consume(clientKey)');
  const distributedConsume = source.indexOf('consumeDistributedRateLimit("AUTH_RATE_LIMITER", clientKey)');
  assert.ok(localConsume >= 0, 'claim route must consume the local limiter');
  assert.ok(distributedConsume >= 0, 'claim route must consume the distributed limiter');
  assert.ok(localConsume < distributedConsume, 'local limiter must run before the distributed limiter');
});

test('free live state and playback remain outside the new distributed limiter', () => {
  const state = read('src/app/api/live/[slug]/state/route.ts');
  const playback = read('src/app/api/live/[slug]/playback/route.ts');
  assert.doesNotMatch(state, /consumeDistributedRateLimit|_RATE_LIMITER/);
  assert.doesNotMatch(playback, /consumeDistributedRateLimit|_RATE_LIMITER/);
});

test('wrangler declares separate rate limit bindings so counters cannot interfere', () => {
  const wrangler = read('wrangler.jsonc');
  for (const binding of [
    'AUTH_RATE_LIMITER',
    'ADMIN_RATE_LIMITER',
    'STUDENT_MUTATION_RATE_LIMITER',
    'PLAYBACK_RATE_LIMITER',
    'CERT_RATE_LIMITER',
  ]) {
    assert.ok(wrangler.includes(`\"name\": \"${binding}\"`), `wrangler must declare ${binding}`);
  }
});
