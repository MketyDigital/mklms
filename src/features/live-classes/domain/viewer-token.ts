import { createHash, randomBytes } from "node:crypto";

export function generateLiveViewerToken(bytes = 24): string {
  return randomBytes(Math.max(16, bytes)).toString("base64url");
}

export function hashLiveViewerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
