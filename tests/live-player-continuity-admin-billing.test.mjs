import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('live player renews authorization without jumping an active viewer backward or to a new live offset', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /sameLoadedMedia\s*&&\s*!forceLiveEdge/);
  assert.match(source, /targetVideo\.currentTime\s*=\s*currentVideo\.currentTime/);
  assert.match(source, /preservedPosition/);
  assert.match(source, /video\.currentTime\s*<\s*target/);
  assert.match(source, /if \(needsPlaybackGesture\) correctPosition\(video\)/);
});

test('live timing and token refresh use the server-synchronized clock instead of the viewer device clock', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /serverClockOffsetMsRef/);
  assert.match(source, /response\.headers\.get\("Age"\)/);
  assert.match(source, /new Date\(synchronizedNowMs\(\)\)/);
  assert.match(source, /expiresAt[\s\S]*synchronizedNowMs\(\)/);
  assert.doesNotMatch(source, /clientNow:\s*new Date\(\)/);
});

test('visibility return and playback errors explicitly rejoin the authoritative live edge', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /forceLiveEdgeOnNextAuthorizationRef\.current\s*=\s*true/);
  assert.match(source, /document\.visibilityState\s*===\s*"visible"/);
  assert.match(source, /handlePlaybackError/);
});

test('hosting payment warning is confined to admin dashboard and only appears in due or unpaid states', () => {
  const admin = read('src/app/(admin)/admin/page.tsx');
  const member = read('src/app/(member)/dashboard/page.tsx');

  assert.match(admin, /resolveManagedHostingPaymentWindow/);
  assert.match(admin, /serviceAccess\.status === "DUE"/);
  assert.match(admin, /serviceAccess\.status === "OVERDUE"/);
  assert.match(admin, /serviceAccess\.status === "RESTRICTED"/);
  assert.match(admin, /paymentStatus === "PAID"/);
  assert.match(admin, /paymentStatus === "WAIVED"/);
  assert.match(admin, /href="\/admin\/hosting"/);

  assert.doesNotMatch(member, /ManagedHosting|Hosting payment|\/admin\/hosting/);
});
