import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldShowLiveAudioPrompt } from '../src/features/live-classes/domain/live-audio-prompt.ts';

const HAVE_FUTURE_DATA = 3;

test('healthy audible active playback never shows an audio prompt from a stale gesture flag', () => {
  assert.equal(shouldShowLiveAudioPrompt({
    muted: false,
    needsPlaybackGesture: true,
    hasActiveMedia: true,
    activeMediaPaused: false,
    activeMediaReadyState: HAVE_FUTURE_DATA,
    futureDataReadyState: HAVE_FUTURE_DATA,
  }), false);
});

test('muted playback always offers the audio button', () => {
  assert.equal(shouldShowLiveAudioPrompt({
    muted: true,
    needsPlaybackGesture: false,
    hasActiveMedia: true,
    activeMediaPaused: false,
    activeMediaReadyState: HAVE_FUTURE_DATA,
    futureDataReadyState: HAVE_FUTURE_DATA,
  }), true);
});

test('audible playback shows resume only when the active media is actually blocked', () => {
  assert.equal(shouldShowLiveAudioPrompt({
    muted: false,
    needsPlaybackGesture: true,
    hasActiveMedia: true,
    activeMediaPaused: true,
    activeMediaReadyState: HAVE_FUTURE_DATA,
    futureDataReadyState: HAVE_FUTURE_DATA,
  }), true);

  assert.equal(shouldShowLiveAudioPrompt({
    muted: false,
    needsPlaybackGesture: true,
    hasActiveMedia: true,
    activeMediaPaused: false,
    activeMediaReadyState: 2,
    futureDataReadyState: HAVE_FUTURE_DATA,
  }), true);
});

test('missing active media can still surface a genuine resume gesture request', () => {
  assert.equal(shouldShowLiveAudioPrompt({
    muted: false,
    needsPlaybackGesture: true,
    hasActiveMedia: false,
    activeMediaPaused: true,
    activeMediaReadyState: 0,
    futureDataReadyState: HAVE_FUTURE_DATA,
  }), true);
});
