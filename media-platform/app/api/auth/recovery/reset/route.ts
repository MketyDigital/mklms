import { NextResponse } from "next/server";
import { getMediaDb } from "../../../../../src/lib/postgres";
import { hashPassword } from "../../../../../src/auth/password";
import { recoveryTokenHash } from "../../../../../src/auth/recovery";
import { allowRequest } from "../../../../../src/auth/rate-limit";

export async function POST(request:Request){
  if(!(await allowRequest(request,"MEDIA_AUTH_RATE_LIMITER","reset-password"))) {
    return NextResponse.redirect(new URL("/reset-password?error=rate",request.url),303);
  }
  const form=await request.formData();
  const token=String(form.get("token")||"");
  const password=String(form.get("password")||"");
  const confirm=String(form.get("confirm")||"");
  if(!token||password.length<10||password!==confirm){
    const url=new URL("/reset-password",request.url);
    url.searchParams.set("error","invalid");
    if(token) url.searchParams.set("token",token);
    return NextResponse.redirect(url,303);
  }

  const hash=await recoveryTokenHash(token);
  const db=getMediaDb();
  const row=await db.prepare(
    "SELECT id,user_id FROM media_password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>datetime('now') LIMIT 1"
  ).bind(hash).first<any>();
  if(!row) return NextResponse.redirect(new URL("/reset-password?error=expired",request.url),303);

  const passwordHash=await hashPassword(password);
  await db.batch([
    db.prepare("UPDATE media_users SET password_hash=? WHERE id=?").bind(passwordHash,String(row.user_id)),
    db.prepare("UPDATE media_password_reset_tokens SET used_at=datetime('now') WHERE id=?").bind(String(row.id)),
    db.prepare("DELETE FROM media_sessions WHERE user_id=?").bind(String(row.user_id)),
  ]);
  return NextResponse.redirect(new URL("/login?reset=1",request.url),303);
}
