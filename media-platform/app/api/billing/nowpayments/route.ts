import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb,getMediaEnv } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  const form=await request.formData();
  const invoiceId=String(form.get("invoiceId")||"");
  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,reference,amount_usd,status FROM media_invoices WHERE id=? AND tenant_id=? LIMIT 1").bind(invoiceId,user.tenantId).first<any>();
  if(!invoice || invoice.status!=="pending") return NextResponse.redirect(new URL("/billing?error=invoice",request.url),303);

  const env=getMediaEnv() as any;
  const apiKey=String(env.NOWPAYMENTS_API_KEY||"");
  if(!apiKey) return NextResponse.redirect(new URL("/billing?error=payments",request.url),303);

  const origin=new URL(request.url).origin;
  const response=await fetch("https://api.nowpayments.io/v1/invoice",{
    method:"POST",
    headers:{"content-type":"application/json","x-api-key":apiKey},
    body:JSON.stringify({
      price_amount:Number(invoice.amount_usd),
      price_currency:"usd",
      order_id:String(invoice.reference),
      order_description:"Mkety Media "+String(invoice.reference),
      ipn_callback_url:origin+"/api/billing/nowpayments/webhook",
      success_url:origin+"/billing?payment=processing",
      cancel_url:origin+"/billing?payment=cancelled",
    }),
  });
  const payload=await response.json().catch(()=>null) as any;
  if(!response.ok || !payload?.invoice_url) return NextResponse.redirect(new URL("/billing?error=payments",request.url),303);

  await db.prepare("UPDATE media_invoices SET payment_method='nowpayments',checkout_provider='nowpayments',provider_invoice_id=?,updated_at=datetime('now') WHERE id=?")
    .bind(String(payload.id||payload.invoice_id||""),invoiceId).run();
  return NextResponse.redirect(String(payload.invoice_url),303);
}
