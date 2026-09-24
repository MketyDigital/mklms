import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../src/lib/current-user";
import { getTenantState } from "../../../src/lib/tenant-state";
import { getMediaDb } from "../../../src/lib/postgres";
import { hashPassword } from "../../../src/auth/password";

export async function POST(request:Request){
  const current=await getCurrentUser();
  if(!current || !["owner","admin"].includes(current.role)) return NextResponse.redirect(new URL("/login",request.url),303);
  const state=await getTenantState(current.tenantId);
  const db=getMediaDb();
  const count=await db.prepare("SELECT COUNT(*) AS n FROM media_memberships WHERE tenant_id=?").bind(current.tenantId).first<any>();
  if(Number(count?.n||0)>=state.teamSeats) return NextResponse.redirect(new URL("/team?error=limit",request.url),303);

  const form=await request.formData();
  const username=String(form.get("username")||"").trim();
  const password=String(form.get("password")||"");
  const role=String(form.get("role")||"member");
  if(!/^[A-Za-z0-9_-]{3,40}$/.test(username)||password.length<10||!["member","admin","billing"].includes(role)) return NextResponse.redirect(new URL("/team?error=invalid",request.url),303);
  const exists=await db.prepare("SELECT id FROM media_users WHERE username=? COLLATE NOCASE LIMIT 1").bind(username).first();
  if(exists) return NextResponse.redirect(new URL("/team?error=username",request.url),303);

  const userId=crypto.randomUUID();
  const passwordHash=await hashPassword(password);
  await db.batch([
    db.prepare("INSERT INTO media_users (id,username,password_hash,status) VALUES (?,?,?,'active')").bind(userId,username,passwordHash),
    db.prepare("INSERT INTO media_memberships (tenant_id,user_id,role) VALUES (?,?,?)").bind(current.tenantId,userId,role),
    db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id) VALUES (?,?,'customer',?,'team.member.created','user',?)").bind(crypto.randomUUID(),current.tenantId,current.userId,userId),
  ]);
  return NextResponse.redirect(new URL("/team",request.url),303);
}
