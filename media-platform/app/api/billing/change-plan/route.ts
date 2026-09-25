import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";
import { getBillingTerms,calculateTermPrice } from "../../../../src/lib/operator-settings";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  const form=await request.formData();
  const planCode=String(form.get("plan")||"");
  const term=Number(form.get("term")||1);
  const db=getMediaDb();

  const tenant=await db.prepare("SELECT status FROM media_tenants WHERE id=? LIMIT 1").bind(user.tenantId).first<any>();
  const pendingInvoice=await db.prepare("SELECT id,payment_method,checkout_provider FROM media_invoices WHERE tenant_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1").bind(user.tenantId).first<any>();
  const subscription=await db.prepare("SELECT status,current_period_end FROM media_subscriptions WHERE tenant_id=? LIMIT 1").bind(user.tenantId).first<any>();
  if(!tenant||String(tenant.status)!=="pending"||String(subscription?.status||"pending")!=="pending"){
    return NextResponse.redirect(new URL("/billing?error=already-active",request.url),303);
  }
  if(pendingInvoice&&(pendingInvoice.checkout_provider||String(pendingInvoice.payment_method||"invoice")!=="invoice")){
    return NextResponse.redirect(new URL("/billing?error=payment-started",request.url),303);
  }
  const terms=await getBillingTerms();
  if(!(terms as any[]).some((x)=>Number(x.months)===term)) return NextResponse.redirect(new URL("/billing?error=term",request.url),303);
  const plan=await db.prepare("SELECT * FROM media_plans WHERE code=? AND active=1 AND code<>'enterprise' LIMIT 1").bind(planCode).first<any>();
  if(!plan) return NextResponse.redirect(new URL("/billing?error=plan",request.url),303);

  const amount=await calculateTermPrice(Number(plan.monthly_usd),term);
  const invoiceId=crypto.randomUUID();
  const reference="MKM-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
  const dueAt=new Date(Date.now()+24*60*60*1000).toISOString();

  await db.batch([
    db.prepare("UPDATE media_invoices SET status='cancelled',updated_at=datetime('now') WHERE tenant_id=? AND status='pending'").bind(user.tenantId),
    db.prepare("UPDATE media_tenants SET plan_code=? WHERE id=?").bind(planCode,user.tenantId),
    db.prepare("UPDATE media_tenant_commercial_terms SET base_plan_code=?,billing_term_months=?,display_name=NULL,monthly_usd=NULL,storage_bytes=NULL,delivery_bytes=NULL,delivery_requests=NULL,logical_buckets=NULL,team_seats=NULL,max_object_bytes=NULL,enterprise_features=0,infrastructure_mode='automatic',preferred_pool_key='r2-global',updated_at=datetime('now') WHERE tenant_id=?").bind(planCode,term,user.tenantId),
    db.prepare("INSERT INTO media_invoices (id,tenant_id,reference,amount_usd,payment_method,status,due_at) VALUES (?,?,?,?,'invoice','pending',?)").bind(invoiceId,user.tenantId,reference,amount,dueAt),
    db.prepare("INSERT INTO media_purchases (invoice_id,tenant_id,purchase_type) VALUES (?,?,'subscription')").bind(invoiceId,user.tenantId),
    db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id,metadata_json) VALUES (?,?,'customer',?,'subscription.selection.changed','tenant',?,?)").bind(crypto.randomUUID(),user.tenantId,user.userId,user.tenantId,JSON.stringify({planCode,term})),
  ]);
  return NextResponse.redirect(new URL("/billing?changed=1",request.url),303);
}
