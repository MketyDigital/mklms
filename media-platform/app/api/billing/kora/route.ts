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
  const secretKey=String(env.KORA_SECRET_KEY||"");
  const publicKey=String(env.KORA_PUBLIC_KEY||"");
  if(!secretKey) return NextResponse.redirect(new URL("/billing?error=kora",request.url),303);

  const origin=new URL(request.url).origin;
  if(request.headers.get("accept")?.includes("application/json")){
    if(!publicKey) return NextResponse.json({ok:false,error:"kora-config"},{status:503});
    await db.batch([
      db.prepare("UPDATE media_users SET email=? WHERE id=?").bind(email,user.userId),
      db.prepare("UPDATE media_invoices SET checkout_provider='kora',provider_invoice_id=?,checkout_amount=?,checkout_currency='USD',updated_at=datetime('now') WHERE id=? AND status='pending'")
        .bind("kora:"+String(invoice.reference),Number(invoice.amount_usd),invoiceId),
    ]);
    return NextResponse.json({
      ok:true,
      publicKey,
      reference:String(invoice.reference),
      amount:Number(invoice.amount_usd),
      currency:"USD",
      email,
      customerName:user.tenantName,
      notificationUrl:origin+"/api/billing/kora/webhook",
      redirectPath:"/billing?payment=processing&provider=kora",
      metadata:{source:"media",invoiceId:String(invoice.id),tenantId:user.tenantId},
    });
  }

  const response=await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize",{
    method:"POST",
    headers:{Authorization:"Bearer "+secretKey,"content-type":"application/json"},
    body:JSON.stringify({
      amount:Number(invoice.amount_usd),
      currency:"USD",
      reference:String(invoice.reference),
      redirect_url:origin+"/billing?payment=processing&provider=kora",
      notification_url:origin+"/api/billing/kora/webhook",
      narration:"Mkety Media "+String(invoice.reference),
      customer:{email,name:user.tenantName},
      metadata:{invoiceId:String(invoice.id),tenantId:user.tenantId},
      merchant_bears_cost:true,
    }),
  });
  const payload=await response.json().catch(()=>null) as any;
  const link=String(payload?.data?.checkout_url||"");
  if(!response.ok || payload?.status!==true || !link) return NextResponse.redirect(new URL("/billing?error=kora",request.url),303);

  await db.batch([
    db.prepare("UPDATE media_users SET email=? WHERE id=?").bind(email,user.userId),
    db.prepare("UPDATE media_invoices SET checkout_provider='kora',provider_invoice_id=?,updated_at=datetime('now') WHERE id=? AND status='pending'")
      .bind("kora:"+String(payload.data.reference||invoice.reference),invoiceId),
  ]);
  return NextResponse.redirect(link,303);
}
