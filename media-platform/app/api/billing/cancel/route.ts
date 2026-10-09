import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);

  const form=await request.formData();
  const invoiceId=String(form.get("invoiceId")||"").trim();
  if(!invoiceId) return NextResponse.redirect(new URL("/billing?error=invoice",request.url),303);

  const db=getMediaDb();
  const state=await db.prepare(
    "SELECT t.status,s.status AS subscription_status FROM media_tenants t LEFT JOIN media_subscriptions s ON s.tenant_id=t.id WHERE t.id=? LIMIT 1"
  ).bind(user.tenantId).first<any>();
  if(!state||String(state.status)!=="pending"||String(state.subscription_status||"pending")!=="pending"){
    return NextResponse.redirect(new URL("/billing?error=active",request.url),303);
  }

  const invoice=await db.prepare(
    "SELECT id,status,payment_method,checkout_provider FROM media_invoices WHERE id=? AND tenant_id=? LIMIT 1"
  ).bind(invoiceId,user.tenantId).first<any>();
  if(!invoice||String(invoice.status)!=="pending"){
    return NextResponse.redirect(new URL("/billing?error=payment-raced",request.url),303);
  }

  const result=await db.prepare(
    "UPDATE media_invoices SET status='cancelled',updated_at=? WHERE id=? AND tenant_id=? AND status='pending' AND EXISTS (SELECT 1 FROM media_tenants t LEFT JOIN media_subscriptions s ON s.tenant_id=t.id WHERE t.id=? AND t.status='pending' AND COALESCE(s.status,'pending')='pending')"
  ).bind(new Date().toISOString(),invoiceId,user.tenantId,user.tenantId).run();
  if(Number(result.meta?.changes||0)!==1){
    return NextResponse.redirect(new URL("/billing?error=payment-raced",request.url),303);
  }

  await db.prepare(
    "INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id,metadata_json) VALUES (?,?,'customer',?,'invoice.cancelled_by_customer','invoice',?,?)"
  ).bind(
    crypto.randomUUID(),
    user.tenantId,
    user.userId,
    invoiceId,
    JSON.stringify({paymentMethod:String(invoice.payment_method||"invoice"),checkoutProvider:String(invoice.checkout_provider||"")})
  ).run();

  return NextResponse.redirect(new URL("/billing?cancelled=1",request.url),303);
}
