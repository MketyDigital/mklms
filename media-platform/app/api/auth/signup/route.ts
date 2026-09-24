import { NextResponse } from "next/server";
import { getMediaDb } from "../../../../src/lib/postgres";
import { hashPassword } from "../../../../src/auth/password";
import { newSessionToken, sessionCookie, sessionTokenHash } from "../../../../src/auth/session";
import { getBillingTerms, calculateTermPrice } from "../../../../src/lib/operator-settings";

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,50);
}

export async function POST(request: Request) {
  const form=await request.formData();
  const name=String(form.get("name")||"").trim();
  const username=String(form.get("username")||"").trim();
  const password=String(form.get("password")||"");
  const planCode=String(form.get("plan")||"starter");
  const termMonths=Number(form.get("term")||1);

  if(!name || !/^[A-Za-z0-9_-]{3,40}$/.test(username) || password.length<10) {
    return NextResponse.redirect(new URL("/signup?error=invalid",request.url),303);
  }
  const billingTerms=await getBillingTerms();\n  if(!(billingTerms as any[]).some((term)=>Number(term.months)===termMonths)) {
    return NextResponse.redirect(new URL("/signup?error=term",request.url),303);
  }

  const db=getMediaDb();
  const plan=await db.prepare("SELECT * FROM media_plans WHERE code=? AND active=1 LIMIT 1").bind(planCode).first<any>();
  if(!plan) return NextResponse.redirect(new URL("/signup?error=plan",request.url),303);

  const existing=await db.prepare("SELECT id FROM media_users WHERE username=? COLLATE NOCASE LIMIT 1").bind(username).first();
  if(existing) return NextResponse.redirect(new URL("/signup?error=username",request.url),303);

  const tenantId=crypto.randomUUID();
  const userId=crypto.randomUUID();
  const invoiceId=crypto.randomUUID();
  const token=newSessionToken();
  const tokenHash=await sessionTokenHash(token);
  const passwordHash=await hashPassword(password);
  const suffix=crypto.randomUUID().slice(0,6);
  const slug=((slugify(name)||"customer")+"-"+suffix).slice(0,63);
  const reference="MKM-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
  const amount=await calculateTermPrice(Number(plan.monthly_usd),termMonths);
  const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
  const dueAt=new Date(Date.now()+24*60*60*1000).toISOString();

  await db.batch([
    db.prepare("INSERT INTO media_tenants (id,slug,name,status,plan_code) VALUES (?,?,?,'pending',?)").bind(tenantId,slug,name,planCode),
    db.prepare("INSERT INTO media_users (id,username,password_hash,status) VALUES (?,?,?,'active')").bind(userId,username,passwordHash),
    db.prepare("INSERT INTO media_memberships (tenant_id,user_id,role) VALUES (?,?,'owner')").bind(tenantId,userId),
    db.prepare("INSERT INTO media_subscriptions (tenant_id,status) VALUES (?,'pending')").bind(tenantId),
    db.prepare("INSERT INTO media_tenant_commercial_terms (tenant_id,base_plan_code,billing_term_months) VALUES (?,?,?)").bind(tenantId,planCode,termMonths),
    db.prepare("INSERT INTO media_invoices (id,tenant_id,reference,amount_usd,payment_method,status,due_at) VALUES (?,?,?,?,'invoice','pending',?)").bind(invoiceId,tenantId,reference,amount,dueAt),
    db.prepare("INSERT INTO media_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(tokenHash,userId,expiresAt),
    db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id) VALUES (?,?,'customer',?,'account.created','tenant',?)").bind(crypto.randomUUID(),tenantId,userId,tenantId),
  ]);

  const response=NextResponse.redirect(new URL("/billing",request.url),303);
  response.headers.set("Set-Cookie",sessionCookie(token));
  return response;
}
