import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";
import { getSetting } from "../../../../src/lib/operator-settings";
import { telegram,telegramConfig,telegramOperatorChatId } from "../../../../src/billing/telegram";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);

  const form=await request.formData();
  const invoiceId=String(form.get("invoiceId")||"");
  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,reference,amount_usd,status,payment_method,checkout_provider FROM media_invoices WHERE id=? AND tenant_id=? LIMIT 1").bind(invoiceId,user.tenantId).first<any>();
  if(!invoice || invoice.status!=="pending") return NextResponse.redirect(new URL("/billing?error=invoice",request.url),303);
  if((invoice.checkout_provider&&String(invoice.checkout_provider)!=="bank_transfer")||!["invoice","bank_transfer"].includes(String(invoice.payment_method||"invoice"))){
    return NextResponse.redirect(new URL("/billing?error=payment-method-locked",request.url),303);
  }

  const bank=await getSetting<any>("bank_transfer",{enabled:false,currency:"NGN",usdToLocalRate:0,roundTo:100,bankName:"",accountName:"",accountNumber:"",paymentUrl:"",paymentProviderName:"",paymentButtonText:"Pay securely",instructions:""});
  if(!bank.enabled) return NextResponse.redirect(new URL("/billing?error=bank-disabled",request.url),303);

  const rate=Number(bank.usdToLocalRate||0);
  const roundTo=Math.max(1,Number(bank.roundTo||1));
  const raw=Number(invoice.amount_usd)*rate;
  const localAmount=rate>0?Math.ceil(raw/roundTo)*roundTo:null;
  const currency=String(bank.currency||"NGN").toUpperCase();

  const saved=await db.prepare("UPDATE media_invoices SET payment_method='bank_transfer',checkout_provider='bank_transfer',amount_local=?,local_currency=?,updated_at=datetime('now') WHERE id=? AND tenant_id=? AND status='pending' AND (checkout_provider IS NULL OR checkout_provider IN ('','bank_transfer')) AND payment_method IN ('invoice','bank_transfer')")
    .bind(localAmount,currency,invoiceId,user.tenantId).run();
  if(Number(saved.meta?.changes||0)!==1) return NextResponse.redirect(new URL("/billing?error=payment-method-locked",request.url),303);

  const cfg=telegramConfig();
  const operatorChatId=await telegramOperatorChatId();
  if(cfg.token&&operatorChatId){
    const amountText=localAmount!=null?currency+" "+Number(localAmount).toLocaleString():"USD $"+Number(invoice.amount_usd).toFixed(2);
    await telegram("sendMessage",{
      chat_id:operatorChatId,
      text:"🏦 Bank transfer initiated\n\nCustomer: "+user.tenantName+"\nInvoice: "+String(invoice.reference)+"\nAmount: "+amountText+"\n\nNo action is required yet. Approve/Reject controls will appear only after the customer submits payment proof through the Mkety Media bot.",
    }).catch((error)=>console.error(error));
  }

  return NextResponse.redirect(new URL("/billing?bank=1",request.url),303);
}
