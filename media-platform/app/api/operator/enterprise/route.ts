import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { getMediaDb } from "../../../../src/lib/postgres";
import { hashPassword } from "../../../../src/auth/password";
import { calculateTermPrice } from "../../../../src/lib/operator-settings";

function slugify(input:string){return input.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,50);}

export async function POST(request:Request){
  if(!(await isOperator())) return NextResponse.redirect(new URL("/operator/login",request.url),303);
  const form=await request.formData();
  const requestId=String(form.get("requestId")||"");
  const username=String(form.get("username")||"").trim();
  const password=String(form.get("password")||"");
  const slug=String(form.get("slug")||"").toLowerCase().trim();
  const monthlyUsd=Number(form.get("monthlyUsd")||0);
  const term=Number(form.get("term")||1);
  const storageGb=Number(form.get("storageGb")||10);
  const deliveryGb=Number(form.get("deliveryGb")||100);
  const requests=Number(form.get("requests")||1000000);
  const buckets=Number(form.get("buckets")||3);
  const seats=Number(form.get("seats")||1);
  const maxObjectGb=Number(form.get("maxObjectGb")||2);
  const infrastructure=String(form.get("infrastructure")||"automatic");
  const preferredPoolKey=String(form.get("preferredPoolKey")||"r2-global");

  if(!/^[A-Za-z0-9_-]{3,40}$/.test(username)||password.length<10||!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)||monthlyUsd<0||![1,3,6,12].includes(term)){
    return NextResponse.redirect(new URL("/operator?error=enterprise",request.url),303);
  }

  const db=getMediaDb();
  const req=await db.prepare("SELECT * FROM media_enterprise_requests WHERE id=? AND status IN ('new','contacted') LIMIT 1").bind(requestId).first<any>();
  if(!req) return NextResponse.redirect(new URL("/operator?error=request",request.url),303);

  const existingUser=await db.prepare("SELECT id FROM media_users WHERE username=? COLLATE NOCASE LIMIT 1").bind(username).first();
  const existingSlug=await db.prepare("SELECT id FROM media_tenants WHERE slug=? LIMIT 1").bind(slug).first();
  if(existingUser||existingSlug) return NextResponse.redirect(new URL("/operator?error=exists",request.url),303);

  let phase="prepare";
  try{
    const tenantId=crypto.randomUUID();
    const userId=crypto.randomUUID();
    const invoiceId=crypto.randomUUID();

    phase="password";
    const passwordHash=await hashPassword(password);

    phase="pricing";
    const reference="MKM-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
    const amount=await calculateTermPrice(monthlyUsd,term);
    const dueAt=new Date(Date.now()+72*60*60*1000).toISOString();

    phase="database";
    await db.batch([
      db.prepare("INSERT INTO media_tenants (id,slug,name,status,plan_code) VALUES (?,?,?,'pending','starter')").bind(tenantId,slug,String(req.company_name)),
      db.prepare("INSERT INTO media_users (id,username,password_hash,status) VALUES (?,?,?,'active')").bind(userId,username,passwordHash),
      db.prepare("INSERT INTO media_memberships (tenant_id,user_id,role) VALUES (?,?,'owner')").bind(tenantId,userId),
      db.prepare("INSERT INTO media_subscriptions (tenant_id,status) VALUES (?,'pending')").bind(tenantId),
      db.prepare("INSERT INTO media_tenant_commercial_terms (tenant_id,base_plan_code,display_name,monthly_usd,storage_bytes,delivery_bytes,delivery_requests,logical_buckets,team_seats,max_object_bytes,overage_mode,enterprise_features,infrastructure_mode,preferred_pool_key,billing_term_months) VALUES (?,'starter',?,?,?,?,?,?,?,?, 'hard-cap',1,?,?,?)")
        .bind(tenantId,"Enterprise",monthlyUsd,Math.round(storageGb*1024**3),Math.round(deliveryGb*1024**3),Math.round(requests),Math.round(buckets),Math.round(seats),Math.round(maxObjectGb*1024**3),infrastructure,preferredPoolKey,term),
      db.prepare("INSERT INTO media_invoices (id,tenant_id,reference,amount_usd,payment_method,status,due_at) VALUES (?,?,?,?,'invoice','pending',?)").bind(invoiceId,tenantId,reference,amount,dueAt),
      db.prepare("INSERT INTO media_purchases (invoice_id,tenant_id,purchase_type) VALUES (?,?,'subscription')").bind(invoiceId,tenantId),
      db.prepare("UPDATE media_enterprise_requests SET status='provisioned',tenant_id=?,updated_at=datetime('now') WHERE id=?").bind(tenantId,requestId),
      db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id) VALUES (?,?,'operator','operator','enterprise.provisioned','tenant',?)").bind(crypto.randomUUID(),tenantId,tenantId),
    ]);

    return NextResponse.redirect(new URL("/operator?provisioned=1&username="+encodeURIComponent(username)+"&invoice="+encodeURIComponent(reference),request.url),303);
  }catch(error:any){
    console.error("Enterprise provisioning failed",phase,error);
    return NextResponse.json({
      error:"Enterprise provisioning failed",
      phase,
      diagnostic:String(error?.message||error||"unknown").slice(0,800),
    },{status:500});
  }
}
