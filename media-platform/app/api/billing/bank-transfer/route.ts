import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";
import { getSetting } from "../../../../src/lib/operator-settings";
import { telegram,telegramConfig } from "../../../../src/billing/telegram";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);

  const form=await request.formData();
  const invoiceId=String(form.get("invoiceId")||"");
  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,reference,amount_usd,status FROM media_invoices WHERE id=? AND tenant_id=? LIMIT 1").bind(invoiceId,user.tenantId).first<any>();
  if(!invoice || invoice.status!=="pending") return NextResponse.redirect(new URL("/billing?error=invoice",request.url),303);

  const bank=await getSetting<any>("bank_transfer",{enabled:false,currency:"NGN",usdToLocalRate:0,roundTo:100,bankName:"",accountName:"",accountNumber:"",instructions:""});
  if(!bank.enabled) return NextResponse.redirect(new URL("/billing?error=bank-disabled",request.url),303);

  const rate=Number(bank.usdToLocalRate||0);
  const roundTo=Math.max(1,Number(bank.roundTo||1));
  const raw=Number(invoice.amount_usd)*rate;
  const localAmount=rate>0?Math.ceil(raw/roundTo)*roundTo:null;
  const currency=String(bank.currency||"NGN").toUpperCase();

  await db.prepare("UPDATE media_invoices SET payment_method='bank_transfer',amount_local=?,local_currency=?,updated_at=datetime('now') WHERE id=?")
    .bind(localAmount,currency,invoiceId).run();

  const cfg=telegramConfig();
  if(cfg.token&&cfg.chatId){
    const amountText=localAmount!=null?currency+" "+Number(localAmount).toLocaleString():"USD $"+Number(invoice.amount_usd).toFixed(2);
    await telegram("sendMessage",{
      chat_id:cfg.chatId,
      text:"🏦 Bank transfer initiated\n\nCustomer: "+user.tenantName+"\nInvoice: "+String(invoice.reference)+"\nAmount: "+amountText+"\n\nNo action is required yet. Approve/Reject controls will appear only after the customer submits payment proof through the Mkety Media bot.",
    }).catch((error)=>console.error(error));
  }

  return NextResponse.redirect(new URL("/billing?bank=1",request.url),303);
}
