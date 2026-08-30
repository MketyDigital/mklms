export function resolveBroadcastPosition(input: {
  liveOffsetSeconds: number;
  serverNow: Date;
  clientNow?: Date;
  durationSeconds: number;
}): number {
  const elapsedSinceSnapshot = Math.max(
    0,
    ((input.clientNow ?? new Date()).getTime() - input.serverNow.getTime()) / 1000,
  );
  return Math.min(
    Math.max(0, input.durationSeconds),
    Math.max(0, input.liveOffsetSeconds + elapsedSinceSnapshot),
  );
}

export function shouldCorrectBroadcastPosition(input: {
  currentSeconds: number;
  expectedSeconds: number;
  toleranceSeconds?: number;
}): boolean {
  const tolerance = Math.max(0.5, input.toleranceSeconds ?? 4);
  return Math.abs(input.currentSeconds - input.expectedSeconds) > tolerance;
}
