export const LIVE_STATE_CACHE_CONTROL =
  "public, max-age=0, s-maxage=5, stale-while-revalidate=30";

export interface OwnLiveComment {
  id: string;
  displayName?: string | null;
  message: string;
  createdAt: string;
}

const MAX_LOCAL_OWN_COMMENTS = 50;

function isOwnLiveComment(value: unknown): value is OwnLiveComment {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    (item.displayName === undefined || item.displayName === null || typeof item.displayName === "string") &&
    typeof item.message === "string" &&
    typeof item.createdAt === "string"
  );
}

export function parseOwnLiveComments(raw: string | null): OwnLiveComment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOwnLiveComment).slice(-MAX_LOCAL_OWN_COMMENTS);
  } catch {
    return [];
  }
}

export function appendOwnLiveComment(
  existing: readonly OwnLiveComment[],
  comment: OwnLiveComment,
): OwnLiveComment[] {
  return [...existing, comment].slice(-MAX_LOCAL_OWN_COMMENTS);
}

export function ownLiveCommentStorageKey(slug: string, sessionId: string): string {
  return `mklms:live:${slug}:session:${sessionId}:own-comments:v2`;
}
