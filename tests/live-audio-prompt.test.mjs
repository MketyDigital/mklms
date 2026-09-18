import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldShowLiveAudioPrompt } from '../src/features/live-classes/domain/live-audio-prompt.ts';

test('healthy audible active playback never shows an audio prompt from a stale gesture flag', () => {
  assert.equal(shouldShowLiveAudioPrompt({
    muted: false,
    needsPlaybackGesture: true,
    activePlaybackBlocked: false,
  }), false);
});

test('muted playback always offers the audio button', () => {
  assert.equal(shouldShowLiveAudioPrompt({
    muted: true,
    needsPlaybackGesture: false,
    activePlaybackBlocked: false,
  }), true);
});

test('audible playback shows resume only when the active player is actually blocked', () => {
  assert.equal(shouldShowLiveAudioPrompt({
    muted: false,
    needsPlaybackGesture: true,
    activePlaybackBlocked: true,
  }), true);
});

test('a blocked-state signal alone does not show an overlay without a gesture requirement', () => {
  assert.equal(shouldShowLiveAudioPrompt({
    muted: false,
    needsPlaybackGesture: false,
    activePlaybackBlocked: true,
  }), false);
});
