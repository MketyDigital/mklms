import { cookies } from "next/headers";

import {
  generateLiveViewerToken,
  hashLiveViewerToken,
  isValidLiveViewerToken,
} from "../domain/viewer-token";

export const LIVE_VIEWER_COOKIE = "mklms_live_viewer";

export interface LiveViewerIdentity {
  token: string;
  tokenHash: string;
  isNew: boolean;
}

export async function getOrCreateLiveViewerIdentity(): Promise<LiveViewerIdentity> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(LIVE_VIEWER_COOKIE)?.value;
  const token = existing && isValidLiveViewerToken(existing)
    ? existing
    : generateLiveViewerToken();

  if (token !== existing) {
    cookieStore.set(LIVE_VIEWER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return {
    token,
    tokenHash: hashLiveViewerToken(token),
    isNew: token !== existing,
  };
}

export async function getLiveViewerIdentity(): Promise<LiveViewerIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(LIVE_VIEWER_COOKIE)?.value;
  if (!token || !isValidLiveViewerToken(token)) return null;
  return { token, tokenHash: hashLiveViewerToken(token), isNew: false };
}
