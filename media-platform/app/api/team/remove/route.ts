import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  const current=await getCurrentUser();
  if(!current || !["owner","admin"].includes(current.role)) return NextResponse.redirect(new URL("/login",request.url),303);
  const form=await request.formData();
  const userId=String(form.get("userId")||"");
  const db=getMediaDb();
  const member=await db.prepare("SELECT role FROM media_memberships WHERE tenant_id=? AND user_id=? LIMIT 1").bind(current.tenantId,userId).first<any>();
  if(member && member.role!=="owner"){
    await db.batch([
      db.prepare("DELETE FROM media_memberships WHERE tenant_id=? AND user_id=?").bind(current.tenantId,userId),
      db.prepare("DELETE FROM media_sessions WHERE user_id=?").bind(userId),
      db.prepare("UPDATE media_users SET status='disabled' WHERE id=?").bind(userId),
      db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id) VALUES (?,?,'customer',?,'team.member.removed','user',?)").bind(crypto.randomUUID(),current.tenantId,current.userId,userId),
    ]);
  }
  return NextResponse.redirect(new URL("/team",request.url),303);
}
