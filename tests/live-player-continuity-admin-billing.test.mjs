import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('live player renews authorization without jumping an active viewer backward or to a new live offset', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /sameLoadedMedia\s*&&\s*!forceLiveEdge\s*&&\s*currentVideo/);
  assert.match(source, /targetVideo\.currentTime\s*=\s*currentVideo\.currentTime/);
  assert.match(source, /currentVideo\.currentTime - targetVideo\.currentTime > 0\.75/);
  assert.match(source, /preservedPosition/);
  assert.match(source, /video\.currentTime\s*<\s*target/);
  assert.match(source, /const recoveringPausedPlayback =[\s\S]*video\.paused \|\| video\.readyState < HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.match(source, /if \(recoveringPausedPlayback\)[\s\S]*forceLiveEdgeOnNextAuthorizationRef\.current = false/);
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
  assert.match(resume, /forceLiveEdgeOnNextAuthorizationRef\.current = false/);
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

test('active playback helper cannot mutate audio prompt state for a non-active media element', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const helperStart = source.indexOf('const keepPlaybackRunning = useCallback');
  const helperEnd = source.indexOf('\n  useEffect(() => () => {', helperStart);
  const helper = source.slice(helperStart, helperEnd);

  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'playback helper must be present');
  assert.match(helper, /video === currentAudioVideo\(\)/);
  assert.match(helper, /setActivePlaybackBlocked\(false\)/);
  assert.match(helper, /setActivePlaybackBlocked\(true\)/);
  assert.match(helper, /\[clearStallRecovery, currentAudioVideo\]/);
});

test('foreground and pause recovery failures only request a prompt while the same active media remains blocked', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /video &&[\s\S]*video === currentAudioVideo\(\)[\s\S]*video\.paused \|\| video\.readyState < HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.match(source, /const handlePlaybackPaused[\s\S]*requestPlayback\(\)\.catch\(\(\) => \{[\s\S]*video === currentAudioVideo\(\)[\s\S]*setNeedsPlaybackGesture\(true\)/);
});

test('forced recovery is not skipped when a session-bound DIRECT authorization URL is unchanged', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /const forceLiveEdge = forceLiveEdgeOnNextAuthorizationRef\.current/);
  assert.match(source, /if \(sameLoadedMedia && sameAuthorization && !forceLiveEdge\) return/);
  assert.match(source, /recoveryUrl\.searchParams\.set\("mk_recovery", String\(generation\)\)/);
  assert.match(source, /targetVideo\.src = sourceUrl/);
});

test('returning to a healthy visible live player does not mute or rebuild it unnecessarily', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const refreshStart = source.indexOf('const refreshVisiblePlayback = () =>');
  const refreshEnd = source.indexOf('const onVisibilityChange = () =>', refreshStart);
  const refresh = source.slice(refreshStart, refreshEnd);

  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, 'foreground recovery block must exist');
  assert.match(refresh, /const needsRecovery =/);
  assert.match(refresh, /video\.paused/);
  assert.match(refresh, /video\.readyState < HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.match(refresh, /authorization\?\.playbackType !== "DIRECT"/);
  assert.match(refresh, /if \(!needsRecovery && !behindLive\)[\s\S]*setActivePlaybackBlocked\(false\)[\s\S]*return/);
  assert.doesNotMatch(refresh, /setMuted\(true\)/);
  assert.doesNotMatch(refresh, /video\.muted = true/);
});

test('real playback errors attempt silent automatic recovery before showing a gesture prompt', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const errorStart = source.indexOf('const handlePlaybackError =');
  const errorEnd = source.indexOf('\n  };', errorStart);
  const handler = source.slice(errorStart, errorEnd);

  assert.match(handler, /setNeedsPlaybackGesture\(false\)/);
  assert.match(handler, /forceLiveEdgeOnNextAuthorizationRef\.current = true/);
  assert.match(handler, /requestPlayback\(\)\.catch/);
  assert.match(handler, /video === currentAudioVideo\(\)/);
  assert.match(handler, /setNeedsPlaybackGesture\(true\)/);
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
  assert.match(
    preloadCatch,
    /currentVideo === currentAudioVideo\(\)[\s\S]*currentVideo\.paused \|\|[\s\S]*currentVideo\.readyState < HTMLMediaElement\.HAVE_FUTURE_DATA[\s\S]*setNeedsPlaybackGesture\(true\)/,
  );
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

test('hidden DIRECT recovery frame waits are bounded so a decoder cannot hang recovery forever', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /LIVE_FRAME_READY_TIMEOUT_MS = 5_000/);
  assert.match(source, /function waitForRenderableFrame\(video: HTMLVideoElement\): Promise<boolean>/);
  assert.match(source, /window\.setTimeout\([\s\S]*finish\(false\)[\s\S]*LIVE_FRAME_READY_TIMEOUT_MS/);
  assert.match(source, /const frameReady = await waitForRenderableFrame\(targetVideo\)/);
  assert.match(source, /if \(!frameReady\)[\s\S]*forceLiveEdgeOnNextAuthorizationRef\.current = true[\s\S]*requestPlayback\(\)/);
  assert.match(source, /const realignedFrameReady = await waitForRenderableFrame\(targetVideo\)/);
  assert.match(source, /if \(!realignedFrameReady\)[\s\S]*requestPlayback\(\)/);
});

test('silent visible mobile freezes are detected even when the browser emits no waiting or stalled event', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /LIVE_SILENT_FREEZE_RECOVERY_MS = 10_000/);
  assert.match(source, /LIVE_PROGRESS_SAMPLE_MS = 2_500/);
  assert.match(source, /silentFreezeSampleRef/);
  assert.match(source, /document\.visibilityState !== "visible"/);
  assert.match(source, /video\.paused/);
  assert.match(source, /video\.ended/);
  assert.match(source, /Math\.abs\(video\.currentTime - previous\.currentTime\) >= 0\.25/);
  assert.match(source, /now - previous\.sampledAtMs < LIVE_SILENT_FREEZE_RECOVERY_MS/);
  assert.match(source, /forceLiveEdgeOnNextAuthorizationRef\.current = true/);
  assert.match(source, /requestPlayback\(\)\.catch/);
});

test('persistent waiting or stalled media recovers only after a guarded timeout and cancels on playing', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /LIVE_STALL_RECOVERY_MS = 12_000/);
  assert.match(source, /onWaiting=\{\(event\) => scheduleStallRecovery\(event\.currentTarget\)\}/);
  assert.match(source, /onStalled=\{\(event\) => scheduleStallRecovery\(event\.currentTarget\)\}/);
  assert.match(source, /video !== currentAudioVideo\(\)/);
  assert.match(source, /loadedMediaSessionRef\.current !== playbackRef\.current\?\.sessionId/);
  assert.match(source, /roomStateRef\.current\?\.state !== "LIVE"/);
  assert.match(source, /video\.readyState >= HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.match(source, /clearStallRecovery\(\);[\s\S]*setNeedsPlaybackGesture\(false\)/);
});

test('playback authorization is single-flight so concurrent recovery signals cannot race source swaps', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const requestStart = source.indexOf('const requestPlayback = useCallback');
  const requestEnd = source.indexOf('\n  useEffect(() => {', requestStart);
  const request = source.slice(requestStart, requestEnd);

  assert.match(request, /playbackRequestRef\.current/);
  assert.match(request, /if \(playbackRequestRef\.current\) return playbackRequestRef\.current/);
  assert.match(request, /playbackRequestRef\.current = request/);
  assert.match(request, /playbackRequestRef\.current === request/);
  assert.match(request, /playbackRequestRef\.current = null/);
});

test('weak-network waiting events preserve DIRECT MP4 buffering before recovery', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const start = source.indexOf('const scheduleStallRecovery = useCallback');
  const end = source.indexOf('\n  useEffect(() => {', start);
  const handler = source.slice(start, end);

  assert.match(handler, /if \(stallRecoveryTimerRef\.current !== null\) return/);
  assert.match(handler, /const stalledAtSeconds = video\.currentTime/);
  assert.match(handler, /Math\.abs\(video\.currentTime - stalledAtSeconds\) >= 0\.5/);
  assert.match(handler, /authorization\?\.playbackType === "HLS"/);
  assert.match(handler, /keepPlaybackRunning\(video, \{ preferAudio: false \}\)/);
  assert.doesNotMatch(handler, /drifted|correctPosition\(video\)/);
  assert.match(handler, /LIVE_FORCED_RECOVERY_COOLDOWN_MS/);
  assert.doesNotMatch(handler, /clearStallRecovery\(\);[\s\S]*stallRecoveryTimerRef\.current = window\.setTimeout/);
});

test('HLS uses conservative adaptive buffering and local fatal recovery before authorization rebuild', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /capLevelToPlayerSize: true/);
  assert.match(source, /abrBandWidthFactor: 0\.75/);
  assert.match(source, /abrBandWidthUpFactor: 0\.6/);
  assert.match(source, /maxBufferLength: 45/);
  assert.match(source, /fragLoadingMaxRetry: 6/);
  assert.match(source, /Hls\.Events\.FRAG_BUFFERED/);
  assert.match(source, /Hls\.ErrorTypes\.NETWORK_ERROR[\s\S]*hls\.startLoad\(\)/);
  assert.match(source, /Hls\.ErrorTypes\.MEDIA_ERROR[\s\S]*hls\.recoverMediaError\(\)/);
  assert.match(source, /LIVE_HLS_FATAL_RECOVERY_ATTEMPTS = 3/);
});

test('staged chat follows the actual media position when playback falls behind the live wall clock', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(source, /const currentPlaybackOffsetSeconds = playedOffsetSeconds/);
  assert.match(source, /loadedMediaSessionRef\.current === active/);
  assert.match(source, /Math\.min\(currentLiveOffsetSeconds, playedOffsetSeconds\)/);
  assert.match(source, /setPlayedOffsetSeconds\(/);
  assert.match(source, /getNewTimelineMessages\([\s\S]*currentPlaybackOffsetSeconds/);
  assert.match(source, /getInitialTimelineMessages\([\s\S]*currentPlaybackOffsetSeconds/);
});

test('large DIRECT MP4 recovery preserves its buffered position and staged chat follows displayed frames', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  assert.match(source, /sameLoadedMedia\s*&&\s*currentVideo\s*&&\s*Number\.isFinite\(currentVideo\.currentTime\)/);
  assert.match(source, /targetVideo\.currentTime = currentVideo\.currentTime/);
  assert.match(source, /const \[playedOffsetSeconds, setPlayedOffsetSeconds\] = useState/);
  assert.match(source, /setPlayedOffsetSeconds\(/);
  const begin = source.indexOf('const currentPlaybackOffsetSeconds =');
  const end = source.indexOf('const timelineSource =', begin);
  assert.match(source.slice(begin, end), /Math\.min\(currentLiveOffsetSeconds, playedOffsetSeconds\)/);
});

test('healthy DIRECT playback ignores native MP4 seeks and does not catch up to wall clock on foreground return', () => {
  const source = read('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const seekingStart = source.indexOf('const handleSeeking =');
  const seekingEnd = source.indexOf('const scheduleStallRecovery =', seekingStart);
  const seeking = source.slice(seekingStart, seekingEnd);

  assert.match(seeking, /playbackType === "DIRECT"/);
  assert.match(seeking, /loadedMediaSessionRef\.current === playbackRef\.current\?\.sessionId/);
  assert.doesNotMatch(seeking, /video\.currentTime = target/);

  const foregroundStart = source.indexOf('const refreshVisiblePlayback =');
  const foregroundEnd = source.indexOf('const onVisibilityChange =', foregroundStart);
  const foreground = source.slice(foregroundStart, foregroundEnd);
  assert.match(foreground, /authorization\?\.playbackType !== "DIRECT"/);
  assert.match(foreground, /shouldCorrectBroadcastPosition/);
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
