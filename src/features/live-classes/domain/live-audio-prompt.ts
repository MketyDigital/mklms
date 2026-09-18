export interface LiveAudioPromptState {
  muted: boolean;
  needsPlaybackGesture: boolean;
  hasActiveMedia: boolean;
  activeMediaPaused: boolean;
  activeMediaReadyState: number;
  futureDataReadyState: number;
}

export function shouldShowLiveAudioPrompt(state: LiveAudioPromptState): boolean {
  if (state.muted) return true;
  if (!state.needsPlaybackGesture) return false;
  if (!state.hasActiveMedia) return true;

  return (
    state.activeMediaPaused ||
    state.activeMediaReadyState < state.futureDataReadyState
  );
}
