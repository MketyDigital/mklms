export interface LiveAudioPromptState {
  muted: boolean;
  needsPlaybackGesture: boolean;
  activePlaybackBlocked: boolean;
}

export function shouldShowLiveAudioPrompt(state: LiveAudioPromptState): boolean {
  if (state.muted) return true;
  return state.needsPlaybackGesture && state.activePlaybackBlocked;
}
