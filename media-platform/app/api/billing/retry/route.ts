import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getTenantState } from "../../../../src/lib/tenant-state";
import { getMediaDb } from "../../../../src/lib/postgres";
import { calculateTermPrice } from "../../../../src/lib/operator-settings";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  const db=getMediaDb();
  const pending=await db.prepare("SELECT id FROM media_invoices WHERE tenant_id=? AND status='pending' LIMIT 1").bind(user.tenantId).first();
  if(pending) return NextResponse.redirect(new URL("/billing",request.url),303);

  const state=await getTenantState(user.tenantId);
  const amount=await calculateTermPrice(state.monthlyUsd,state.billingTermMonths);
  const reference="MKM-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
  const dueAt=new Date(Date.now()+24*60*60*1000).toISOString();
  await db.prepare("INSERT INTO media_invoices (id,tenant_id,reference,amount_usd,payment_method,status,due_at) VALUES (?,?,?,?,'invoice','pending',?)")
    .bind(crypto.randomUUID(),user.tenantId,reference,amount,dueAt).run();
  return NextResponse.redirect(new URL("/billing",request.url),303);
}
