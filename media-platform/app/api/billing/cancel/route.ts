import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  const db=getMediaDb();
  const state=await db.prepare("SELECT t.status,s.status AS subscription_status FROM media_tenants t LEFT JOIN media_subscriptions s ON s.tenant_id=t.id WHERE t.id=? LIMIT 1").bind(user.tenantId).first<any>();
  if(!state||String(state.status)!=="pending"||String(state.subscription_status||"pending")!=="pending"){
    return NextResponse.redirect(new URL("/billing?error=active",request.url),303);
  }
  await db.prepare("UPDATE media_invoices SET status='cancelled',updated_at=datetime('now') WHERE tenant_id=? AND status='pending'").bind(user.tenantId).run();
  return NextResponse.redirect(new URL("/billing?cancelled=1",request.url),303);
}
