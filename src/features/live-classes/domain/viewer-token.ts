import { createHash, randomBytes } from "node:crypto";

const LIVE_VIEWER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,256}$/;

export function generateLiveViewerToken(bytes = 24): string {
  return randomBytes(Math.max(16, bytes)).toString("base64url");
}

export function hashLiveViewerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidLiveViewerToken(token: string): boolean {
  return LIVE_VIEWER_TOKEN_PATTERN.test(token);
}
