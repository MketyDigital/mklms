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
  assert.match(source, /currentVideo\.currentTime - targetVideo\.currentTime > 0\.75/);
  assert.match(source, /preservedPosition/);
  assert.match(source, /video\.currentTime\s*<\s*target/);
  assert.match(source, /const recoveringPausedPlayback = needsPlaybackGesture \|\| video\.paused/);
  assert.match(source, /if \(recoveringPausedPlayback\)[\s\S]*correctPosition\(video\)/);
});

test('live timing and token refresh use the server-synchronized clock instead of the viewer device clock', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /serverClockOffsetMsRef/);
  assert.match(source, /response\.headers\.get\("Age"\)/);
  assert.match(source, /new Date\(synchronizedNowMs\(\)\)/);
  assert.match(source, /expiresAt[\s\S]*synchronizedNowMs\(\)/);
  assert.doesNotMatch(source, /clientNow:\s*new Date\(\)/);
});



test('mobile audio tap unmutes in the user gesture without seeking a player that is already running', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const resumeStart = source.indexOf('const resumePlayback = () =>');
  const resumeEnd = source.indexOf('\n  };', resumeStart);
  const resume = source.slice(resumeStart, resumeEnd);

  assert.ok(resumeStart >= 0, 'resume handler must exist');
  assert.match(resume, /mutedRef\.current = false/);
  assert.match(resume, /video\.muted = false/);
  assert.match(resume, /await video\.play\(\)/);
  assert.match(resume, /recoveringPausedPlayback/);
  assert.doesNotMatch(resume, /correctPosition\(video\);[\s\S]*const recoveringPausedPlayback/);
});

test('mobile foreground and network recovery rejoin live muted when audible autoplay may be blocked', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /window\.addEventListener\("pageshow", onPageShow\)/);
  assert.match(source, /window\.addEventListener\("online", onOnline\)/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /mutedRef\.current = true;[\s\S]*setMuted\(true\);[\s\S]*video\.muted = true/);
  assert.match(source, /forceLiveEdgeOnNextAuthorizationRef\.current = true;[\s\S]*requestPlayback\(\)/);
});

test('mobile autoplay fallback keeps the live picture running if audible restart is rejected', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /const keepPlaybackRunning = useCallback/);
  assert.match(source, /video\.muted = false;[\s\S]*await video\.play\(\)/);
  assert.match(source, /mutedRef\.current = true;[\s\S]*video\.muted = true;[\s\S]*await video\.play\(\)/);
  assert.match(source, /const targetPlaying = await keepPlaybackRunning\(targetVideo\)/);
  assert.match(source, /void keepPlaybackRunning\(video\)\.then/);
});

test('persistent waiting or stalled media recovers only after a guarded timeout and cancels on playing', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /LIVE_STALL_RECOVERY_MS = 8_000/);
  assert.match(source, /onWaiting=\{\(event\) => scheduleStallRecovery\(event\.currentTarget\)\}/);
  assert.match(source, /onStalled=\{\(event\) => scheduleStallRecovery\(event\.currentTarget\)\}/);
  assert.match(source, /video !== currentAudioVideo\(\)/);
  assert.match(source, /loadedMediaSessionRef\.current !== playbackRef\.current\?\.sessionId/);
  assert.match(source, /roomStateRef\.current\?\.state !== "LIVE"/);
  assert.match(source, /video\.readyState >= HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.match(source, /clearStallRecovery\(\);[\s\S]*setNeedsPlaybackGesture\(false\)/);
});

test('visibility return and playback errors explicitly rejoin the authoritative live edge', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /forceLiveEdgeOnNextAuthorizationRef\.current\s*=\s*true/);
  assert.match(source, /document\.visibilityState\s*===\s*"visible"/);
  assert.match(source, /handlePlaybackError/);
});


test('final live session ending message and redirect remain available after state.session becomes null', () => {
  const route = read('src/app/api/live/[slug]/state/route.ts');

  assert.match(route, /const endedSession = state\.state === "ENDED"/);
  assert.match(route, /item\.status === "PUBLISHED"/);
  assert.match(route, /endedSession\?\.endedMessage \?\? batch\.endedMessage/);
  assert.match(route, /endedSession\?\.endedRedirectUrl \?\? batch\.endedRedirectUrl/);
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
  assert.match(admin, /AdminHostingNoticeRefresh/);

  const refresh = read('src/features/hosting/components/admin-hosting-notice-refresh.tsx');
  assert.match(refresh, /5 \* 60 \* 1000/);
  assert.match(refresh, /visibilitychange/);
  assert.match(refresh, /router\.refresh\(\)/);

  assert.doesNotMatch(member, /ManagedHosting|Hosting payment|AdminHostingNoticeRefresh|\/admin\/hosting/);
});
