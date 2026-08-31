export interface PlaybackAuthInput {
  assetId: string;
  objectKey: string;
  viewer: string;
  expiresEpoch: number;
  signature: string;
}

export type PlaybackAuthResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "MALFORMED"
        | "EXPIRED"
        | "INVALID_SIGNATURE";
    };

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

export function normalizeObjectKey(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const key = decoded.replace(/^\/+/, "");
  if (!key || key.includes("\0") || key.includes("\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(key)) return null;

  const segments = key.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }

  return key;
}

export async function verifyPlaybackAuthorization(
  input: PlaybackAuthInput,
  secret: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<PlaybackAuthResult> {
  if (
    !secret ||
    !input.assetId ||
    !input.objectKey ||
    !input.viewer ||
    !input.signature ||
    !Number.isSafeInteger(input.expiresEpoch) ||
    input.expiresEpoch <= 0
  ) {
    return { ok: false, reason: "MALFORMED" };
  }

  if (input.expiresEpoch <= nowEpochSeconds) {
    return { ok: false, reason: "EXPIRED" };
  }

  const payload = [
    input.assetId,
    input.objectKey,
    input.viewer,
    input.expiresEpoch,
  ].join("|");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const expected = bytesToBase64Url(new Uint8Array(digest));

  return constantTimeEqual(expected, input.signature)
    ? { ok: true }
    : { ok: false, reason: "INVALID_SIGNATURE" };
}
