export interface LiveTimelineMessage {
  id: string;
  offsetSeconds: number;
  displayName: string;
  message: string;
  position: number;
}

function ordered(messages: readonly LiveTimelineMessage[]): LiveTimelineMessage[] {
  return [...messages].sort(
    (a, b) => a.offsetSeconds - b.offsetSeconds || a.position - b.position,
  );
}

export function getInitialTimelineMessages(
  messages: readonly LiveTimelineMessage[],
  liveOffsetSeconds: number,
  recentLimit = 20,
): LiveTimelineMessage[] {
  const reached = ordered(messages).filter(
    (item) => item.offsetSeconds <= Math.max(0, liveOffsetSeconds),
  );
  return reached.slice(-Math.max(0, Math.floor(recentLimit)));
}

export function getNewTimelineMessages(
  messages: readonly LiveTimelineMessage[],
  liveOffsetSeconds: number,
  seenIds: ReadonlySet<string>,
): LiveTimelineMessage[] {
  const live = Math.max(0, liveOffsetSeconds);
  return ordered(messages).filter(
    (item) => item.offsetSeconds <= live && !seenIds.has(item.id),
  );
}

export function getTimelineMessagesAfter(
  messages: readonly LiveTimelineMessage[],
  input: { afterOffsetSeconds: number; liveOffsetSeconds: number },
): LiveTimelineMessage[] {
  const after = Math.max(0, input.afterOffsetSeconds);
  const live = Math.max(0, input.liveOffsetSeconds);
  return ordered(messages).filter(
    (item) => item.offsetSeconds > after && item.offsetSeconds <= live,
  );
}

export function isLiveCtaVisible(input: {
  revealOffsetSeconds?: number | null;
  liveOffsetSeconds: number;
}): boolean {
  if (input.revealOffsetSeconds == null) return true;
  return Math.max(0, input.liveOffsetSeconds) >= Math.max(0, input.revealOffsetSeconds);
}
