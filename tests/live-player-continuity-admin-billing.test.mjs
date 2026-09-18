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
  assert.match(source, /const recoveringPausedPlayback =[\s\S]*video\.paused \|\| video\.readyState < HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.match(source, /if \(recoveringPausedPlayback\)[\s\S]*correctPosition\(video\)/);
});

test('foreground rollover never seeks a new session using stale previous-session timing', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /const currentPlayback = playbackRef\.current/);
  assert.match(source, /currentState\.session\.id !== currentPlayback\?\.sessionId/);
  assert.match(source, /return currentPlayback\?\.startAtSeconds \?\? 0/);
});

test('healthy DIRECT live playback does not rotate its source again before the scheduled session end', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /authorization\.playbackType === "DIRECT" && roomState\.session/);
  assert.match(source, /const sessionEndsAtMs/);
  assert.match(source, /new Date\(expiry\)\.getTime\(\) >= sessionEndsAtMs - 1_000/);
  assert.match(source, /There is[\s\S]*no reason to rotate a healthy active media element before class end/);
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
  assert.match(resume, /video\.paused \|\| video\.readyState < HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.doesNotMatch(resume, /needsPlaybackGesture \|\| video\.paused/);
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

test('unexpected visible mobile pauses recover automatically in muted autoplay-safe mode', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /const handlePlaybackPaused/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /keepPlaybackRunning\(video, \{ preferAudio: false \}\)/);
  assert.match(source, /if \(playing\) return;[\s\S]*forceLiveEdgeOnNextAuthorizationRef\.current = true/);
});

test('mobile autoplay fallback keeps the active live picture running if audible restart is rejected', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /const keepPlaybackRunning = useCallback/);
  assert.match(source, /video\.muted = false;[\s\S]*await video\.play\(\)/);
  assert.match(source, /mutedRef\.current = true;[\s\S]*video\.muted = true;[\s\S]*await video\.play\(\)/);
  assert.match(source, /void keepPlaybackRunning\(video\)\.then/);
  assert.doesNotMatch(source, /keepPlaybackRunning\(targetVideo\)/);
});

test('hidden DIRECT authorization refresh cannot raise the active audio prompt or emit duplicate audio', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const directStart = source.indexOf('if (authorization.playbackType === "DIRECT")');
  const hlsStart = source.indexOf('const video = hlsVideoRef.current', directStart);
  const direct = source.slice(directStart, hlsStart);

  assert.ok(directStart >= 0 && hlsStart > directStart, 'DIRECT handoff block must be present');
  assert.match(direct, /targetVideo\.muted = true/);
  assert.match(direct, /await targetVideo\.play\(\)/);
  assert.match(direct, /LIVE_AUTHORIZATION_RETRY_MS/);
  assert.match(direct, /const shouldStayMuted = mutedRef\.current/);
  assert.match(direct, /setDirectSlot\(targetSlot\);[\s\S]*targetVideo\.muted = shouldStayMuted/);
  assert.doesNotMatch(direct, /keepPlaybackRunning\(targetVideo\)/);

  const preloadCatch = direct.slice(
    direct.indexOf('try {\n          await targetVideo.play()'),
    direct.indexOf('if (generation !== directSwapGenerationRef.current) return;', direct.indexOf('try {\n          await targetVideo.play()')),
  );
  assert.doesNotMatch(preloadCatch, /setNeedsPlaybackGesture\(true\)/);
  assert.doesNotMatch(preloadCatch, /setMuted\(true\)/);
});

test('audio overlay is defensively tied to explicit active playback health state', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /shouldShowLiveAudioPrompt/);
  assert.match(source, /activePlaybackBlocked/);
  assert.match(source, /setActivePlaybackBlocked\(false\)/);
  assert.match(source, /setActivePlaybackBlocked\(true\)/);
  assert.match(source, /\{showAudioPrompt \? \(/);
  assert.doesNotMatch(source, /const activeMedia = currentAudioVideo\(\)/);
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
