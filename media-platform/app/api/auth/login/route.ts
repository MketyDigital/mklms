import { NextResponse } from "next/server";
import { getMediaDb } from "../../../../src/lib/postgres";
import { verifyPassword } from "../../../../src/auth/password";
import { newSessionToken, sessionCookie, sessionTokenHash } from "../../../../src/auth/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");

  const db = getMediaDb();
  const result = await db.query(
    "SELECT id,password_hash FROM media_users WHERE lower(username)=lower($1) AND status='active' LIMIT 1",
    [username],
  );
  const user = result.rows[0];
  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const token = newSessionToken();
  const tokenHash = await sessionTokenHash(token);
  await db.query(
    "INSERT INTO media_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '30 days')",
    [tokenHash, user.id],
  );

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}
