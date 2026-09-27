import { NextResponse } from "next/server";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";
import { allowRequest } from "../../../../../src/auth/rate-limit";
import { newRecoveryToken,recoveryTokenHash } from "../../../../../src/auth/recovery";
import { telegram } from "../../../../../src/billing/telegram";

export async function POST(request:Request){
  if(!(await allowRequest(request,"MEDIA_AUTH_RATE_LIMITER","recovery"))) {
    return NextResponse.redirect(new URL("/forgot-password?error=rate",request.url),303);
  }
  const form=await request.formData();
  const identifier=String(form.get("identifier")||"").trim();
  const db=getMediaDb();
  const user=await db.prepare(
    "SELECT id FROM media_users WHERE (username=? COLLATE NOCASE OR email=? COLLATE NOCASE) AND status='active' LIMIT 1"
  ).bind(identifier,identifier.toLowerCase()).first<any>();

  if(user){
    const link=await db.prepare(
      "SELECT telegram_chat_id FROM media_account_recovery_links WHERE user_id=? AND telegram_chat_id IS NOT NULL LIMIT 1"
    ).bind(String(user.id)).first<any>();
    if(link?.telegram_chat_id){
      const token=newRecoveryToken();
      const hash=await recoveryTokenHash(token);
      const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
      await db.prepare(
        "INSERT INTO media_password_reset_tokens (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)"
      ).bind(crypto.randomUUID(),String(user.id),hash,expiresAt).run();
      const origin=new URL(request.url).origin;
      await telegram("sendMessage",{
        chat_id:String(link.telegram_chat_id),
        text:"🔐 Mkety Media account recovery\n\nA password reset was requested for your account. If this was you, use the secure link below within 15 minutes.\n\n"+origin+"/reset-password?token="+token+"\n\nIf you did not request this, ignore this message.",
      }).catch(()=>undefined);
    }
  }

  const env=getMediaEnv() as any;
  const bot=String(env.MEDIA_TELEGRAM_BOT_USERNAME||"");
  const url=new URL("/forgot-password",request.url);
  url.searchParams.set("status","sent");
  if(bot) url.searchParams.set("support","https://t.me/"+bot);
  return NextResponse.redirect(url,303);
}
