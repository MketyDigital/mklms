import type { PaidLiveState } from "../domain/model";

export function resolvePaidLiveState(input: {
  startsAt: Date;
  endsAt: Date;
  now?: Date;
}): PaidLiveState {
  const now = input.now ?? new Date();
  if (now < input.startsAt) return "UPCOMING";
  if (now >= input.endsAt) return "ENDED";
  return "LIVE";
}
