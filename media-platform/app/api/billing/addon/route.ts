import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getTenantState } from "../../../../src/lib/tenant-state";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);

  const state=await getTenantState(user.tenantId);
  if(state.status!=="active" || state.subscriptionStatus!=="active" || !state.renewalAt || new Date(state.renewalAt).getTime()<=Date.now()){
    return NextResponse.redirect(new URL("/billing?error=inactive",request.url),303);
  }

  const form=await request.formData();
  const addonCode=String(form.get("addon")||"");
  const db=getMediaDb();

  const pending=await db.prepare("SELECT id FROM media_invoices WHERE tenant_id=? AND status='pending' LIMIT 1").bind(user.tenantId).first();
  if(pending) return NextResponse.redirect(new URL("/billing?error=pending",request.url),303);

  const addon=await db.prepare("SELECT * FROM media_addon_products WHERE code=? AND active=1 LIMIT 1").bind(addonCode).first<any>();
  if(!addon) return NextResponse.redirect(new URL("/billing?error=addon",request.url),303);

  const invoiceId=crypto.randomUUID();
  const reference="MKM-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
  const dueAt=new Date(Date.now()+24*60*60*1000).toISOString();

  await db.batch([
    db.prepare("INSERT INTO media_invoices (id,tenant_id,reference,amount_usd,payment_method,status,due_at) VALUES (?,?,?,?,'invoice','pending',?)")
      .bind(invoiceId,user.tenantId,reference,Number(addon.price_usd),dueAt),
    db.prepare("INSERT INTO media_purchases (invoice_id,tenant_id,purchase_type,addon_code) VALUES (?,?,'addon',?)")
      .bind(invoiceId,user.tenantId,addonCode),
  ]);

  return NextResponse.redirect(new URL("/billing?purchase=addon",request.url),303);
}
