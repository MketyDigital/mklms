import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../src/lib/current-user";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";
import { newRecoveryToken,recoveryTokenHash } from "../../../../../src/auth/recovery";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  const env=getMediaEnv() as any;
  const bot=String(env.MEDIA_TELEGRAM_BOT_USERNAME||"");
  if(!bot) return NextResponse.redirect(new URL("/billing?recovery=unavailable",request.url),303);

  const token=newRecoveryToken(24);
  const hash=await recoveryTokenHash(token);
  const expiresAt=new Date(Date.now()+10*60*1000).toISOString();
  const db=getMediaDb();
  await db.prepare(
    "INSERT INTO media_recovery_binding_tokens (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)"
  ).bind(crypto.randomUUID(),user.userId,hash,expiresAt).run();

  return NextResponse.redirect("https://t.me/"+bot+"?start=recovery_"+token,303);
}
