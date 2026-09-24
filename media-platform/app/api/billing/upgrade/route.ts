import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getTenantState } from "../../../../src/lib/tenant-state";
import { getMediaDb } from "../../../../src/lib/postgres";
import { allowMutation } from "../../../../src/lib/rate-limit";

function addMonths(date:Date,months:number){
  const next=new Date(date);
  const day=next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth()+months);
  const maxDay=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
  next.setUTCDate(Math.min(day,maxDay));
  return next;
}

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  if(!(await allowMutation(user.userId))) return NextResponse.redirect(new URL("/billing?error=rate",request.url),303);

  const state=await getTenantState(user.tenantId);
  if(state.status!=="active" || state.subscriptionStatus!=="active" || !state.renewalAt) {
    return NextResponse.redirect(new URL("/billing?error=inactive",request.url),303);
  }
  if(state.enterpriseFeatures){
    return NextResponse.redirect(new URL("/billing?error=custom-plan",request.url),303);
  }

  const form=await request.formData();
  const targetPlanCode=String(form.get("plan")||"");
  const db=getMediaDb();

  const pending=await db.prepare("SELECT id FROM media_invoices WHERE tenant_id=? AND status='pending' LIMIT 1").bind(user.tenantId).first();
  if(pending) return NextResponse.redirect(new URL("/billing?error=pending",request.url),303);

  const current=await db.prepare("SELECT t.plan_code,p.monthly_usd FROM media_tenants t JOIN media_plans p ON p.code=t.plan_code WHERE t.id=? LIMIT 1").bind(user.tenantId).first<any>();
  const target=await db.prepare("SELECT code,monthly_usd FROM media_plans WHERE code=? AND active=1 LIMIT 1").bind(targetPlanCode).first<any>();
  if(!current || !target || Number(target.monthly_usd)<=Number(current.monthly_usd)){
    return NextResponse.redirect(new URL("/billing?error=upgrade",request.url),303);
  }

  const end=new Date(String(state.renewalAt));
  const start=addMonths(end,-state.billingTermMonths);
  const total=Math.max(1,end.getTime()-start.getTime());
  const remaining=Math.max(0,end.getTime()-Date.now());
  const fraction=Math.max(0,Math.min(1,remaining/total));
  const fullDifference=(Number(target.monthly_usd)-Number(current.monthly_usd))*state.billingTermMonths;
  const amount=Math.max(1,Math.round(fullDifference*fraction*100)/100);

  const invoiceId=crypto.randomUUID();
  const reference="MKM-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
  const dueAt=new Date(Date.now()+24*60*60*1000).toISOString();

  await db.batch([
    db.prepare("INSERT INTO media_invoices (id,tenant_id,reference,amount_usd,payment_method,status,due_at) VALUES (?,?,?,?,'invoice','pending',?)")
      .bind(invoiceId,user.tenantId,reference,amount,dueAt),
    db.prepare("INSERT INTO media_purchases (invoice_id,tenant_id,purchase_type,target_plan_code,metadata_json) VALUES (?,?,'plan_upgrade',?,?)")
      .bind(invoiceId,user.tenantId,targetPlanCode,JSON.stringify({fromPlan:String(current.plan_code),fractionRemaining:fraction})),
  ]);

  return NextResponse.redirect(new URL("/billing?purchase=upgrade",request.url),303);
}
