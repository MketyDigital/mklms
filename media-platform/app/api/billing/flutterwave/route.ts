import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb,getMediaEnv } from "../../../../src/lib/postgres";

function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);

  const form=await request.formData();
  const invoiceId=String(form.get("invoiceId")||"");
  const email=String(form.get("email")||user.email||"").trim().toLowerCase();
  if(!validEmail(email)) return NextResponse.redirect(new URL("/billing?error=email",request.url),303);

  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,reference,amount_usd,status FROM media_invoices WHERE id=? AND tenant_id=? LIMIT 1").bind(invoiceId,user.tenantId).first<any>();
  if(!invoice || invoice.status!=="pending") return NextResponse.redirect(new URL("/billing?error=invoice",request.url),303);

  const env=getMediaEnv() as any;
  const brokerUrl=String(env.FLUTTERWAVE_CHECKOUT_BROKER_URL||"").trim();
  const brokerSecret=String(env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET||"");
  const legacySecret=String(env.FLUTTERWAVE_V3_SECRET_KEY||"");
  const legacyHash=String(env.FLUTTERWAVE_V3_SECRET_HASH||"");
  const origin=new URL(request.url).origin;
  let checkoutUrl="";

  if(brokerUrl&&brokerSecret){
    const response=await fetch(brokerUrl,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":"Bearer "+brokerSecret,
      },
      body:JSON.stringify({
        source:"media",
        reference:String(invoice.reference),
        amount:Number(invoice.amount_usd),
        currency:"USD",
        email,
        customer_name:user.tenantName,
        invoice_id:String(invoice.id),
        tenant_id:user.tenantId,
        redirect_url:origin+"/billing?payment=processing&provider=flutterwave",
        media_webhook_url:origin+"/api/billing/flutterwave/webhook",
      }),
    });
    const payload=await response.json().catch(()=>null) as any;
    checkoutUrl=String(payload?.url||payload?.checkout_url||"");
    if(!response.ok||!checkoutUrl) return NextResponse.redirect(new URL("/billing?error=flutterwave",request.url),303);
  } else if(legacySecret&&legacyHash){
    const response=await fetch("https://api.flutterwave.com/v3/payments",{
      method:"POST",
      headers:{Authorization:"Bearer "+legacySecret,"content-type":"application/json"},
      body:JSON.stringify({
        tx_ref:String(invoice.reference),
        amount:Number(invoice.amount_usd).toFixed(2),
        currency:"USD",
        redirect_url:origin+"/billing?payment=processing&provider=flutterwave",
        customer:{email,name:user.tenantName},
        customizations:{
          title:"Mkety Media",
          description:"Mkety Media invoice "+String(invoice.reference),
          logo:origin+"/icon.png",
        },
        meta:{source:"media",invoice_id:String(invoice.id),tenant_id:user.tenantId},
      }),
    });
    const payload=await response.json().catch(()=>null) as any;
    checkoutUrl=String(payload?.data?.link||"");
    if(!response.ok||payload?.status!=="success"||!checkoutUrl) return NextResponse.redirect(new URL("/billing?error=flutterwave",request.url),303);
  } else {
    return NextResponse.redirect(new URL("/billing?error=flutterwave-config",request.url),303);
  }

  await db.batch([
    db.prepare("UPDATE media_users SET email=? WHERE id=?").bind(email,user.userId),
    db.prepare("UPDATE media_invoices SET checkout_provider='flutterwave',provider_invoice_id=?,updated_at=datetime('now') WHERE id=? AND status='pending'")
      .bind("flutterwave:"+String(invoice.reference),invoiceId),
  ]);
  return NextResponse.redirect(checkoutUrl,303);
}
