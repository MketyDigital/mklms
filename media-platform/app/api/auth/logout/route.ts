import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMediaDb } from "../../../../src/lib/postgres";
import { clearSessionCookie, sessionTokenHash } from "../../../../src/auth/session";

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get("mkety_media_session")?.value;
  if (token) {
    const hash = await sessionTokenHash(token);
    await getMediaDb().query("DELETE FROM media_sessions WHERE token_hash=$1", [hash]);
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
