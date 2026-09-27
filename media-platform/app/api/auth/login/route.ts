import { NextResponse } from "next/server";
import { getMediaDb } from "../../../../src/lib/postgres";
import { verifyPassword } from "../../../../src/auth/password";
import { newSessionToken, sessionCookie, sessionTokenHash } from "../../../../src/auth/session";
import { allowAuthAttempt } from "../../../../src/lib/rate-limit";
import { allowRequest } from "../../../../src/auth/rate-limit";

export async function POST(request: Request) {
  if(!(await allowRequest(request,"MEDIA_AUTH_RATE_LIMITER","login"))) return new Response("Too many requests",{status:429});
  const form=await request.formData();
  const identifier=String(form.get("username")||"").trim();
  const password=String(form.get("password")||"");
  if(!(await allowAuthAttempt(identifier||"unknown"))) return NextResponse.redirect(new URL("/login?error=rate",request.url),303);
  const db=getMediaDb();
  const user=await db.prepare("SELECT id,password_hash FROM media_users WHERE (username=? COLLATE NOCASE OR email=? COLLATE NOCASE) AND status='active' LIMIT 1")
    .bind(identifier,identifier.toLowerCase()).first<any>();

  if(!user || !(await verifyPassword(password,String(user.password_hash)))) {
    return NextResponse.redirect(new URL("/login?error=1",request.url),303);
  }

  const token=newSessionToken();
  const tokenHash=await sessionTokenHash(token);
  const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
  await db.prepare("INSERT INTO media_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(tokenHash,String(user.id),expiresAt).run();

  const account=await db.prepare(
    "SELECT t.status FROM media_memberships m JOIN media_tenants t ON t.id=m.tenant_id WHERE m.user_id=? ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END LIMIT 1"
  ).bind(String(user.id)).first<any>();
  const destination=String(account?.status||"")==="pending"?"/billing":"/dashboard";
  const response=NextResponse.redirect(new URL(destination,request.url),303);
  response.headers.set("Set-Cookie",sessionCookie(token));
  return response;
}
