import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { newRecoveryToken, recoveryTokenHash } from "../../../../src/auth/recovery";
import { allowRequest } from "../../../../src/auth/rate-limit";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  if(!(await isOperator())) {
    return NextResponse.json({error:"Operator sign-in required."},{status:401});
  }
  if(!(await allowRequest(request,"MEDIA_AUTH_RATE_LIMITER","operator-recovery"))) {
    return NextResponse.json({error:"Too many recovery links requested. Try again shortly."},{status:429});
  }

  const form=await request.formData();
  const identifier=String(form.get("identifier")||"").trim().slice(0,254);
  if(!identifier) return NextResponse.json({error:"Enter the customer email or username."},{status:400});

  const db=getMediaDb();
  const user=await db.prepare(
    "SELECT id,username FROM media_users WHERE (username=? COLLATE NOCASE OR email=? COLLATE NOCASE) AND status='active' LIMIT 1"
  ).bind(identifier,identifier.toLowerCase()).first<any>();
  if(!user) return NextResponse.json({error:"No active account matched that email or username."},{status:404});

  const token=newRecoveryToken();
  const tokenHash=await recoveryTokenHash(token);
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  const resetUrl=new URL("/reset-password",request.url);
  resetUrl.searchParams.set("token",token);

  await db.batch([
    db.prepare("UPDATE media_password_reset_tokens SET used_at=datetime('now') WHERE user_id=? AND used_at IS NULL").bind(String(user.id)),
    db.prepare(
      "INSERT INTO media_password_reset_tokens (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)"
    ).bind(crypto.randomUUID(),String(user.id),tokenHash,expiresAt),
    db.prepare(
      "INSERT INTO media_audit_log (id,actor_type,actor_id,action,target_type,target_id,metadata_json) VALUES (?,'operator','operator','account.recovery.link.issued','user',?,?)"
    ).bind(crypto.randomUUID(),String(user.id),JSON.stringify({delivery:"operator_manual",expiresInMinutes:15})),
  ]);

  return NextResponse.json({
    ok:true,
    username:String(user.username),
    resetUrl:resetUrl.toString(),
    expiresInMinutes:15,
  });
}
