import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { getMediaDb } from "../../../../src/lib/postgres";
import { settleInvoice } from "../../../../src/billing/settle";

export async function POST(request:Request){
  if(!(await isOperator())) return NextResponse.redirect(new URL("/operator/login",request.url),303);
  const form=await request.formData();
  const invoiceId=String(form.get("invoiceId")||"");
  const action=String(form.get("action")||"");
  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,status FROM media_invoices WHERE id=? LIMIT 1").bind(invoiceId).first<any>();
  if(!invoice) return NextResponse.redirect(new URL("/operator?error=invoice",request.url),303);

  if(action==="approve" && invoice.status==="pending"){
    await settleInvoice({invoiceId,provider:"bank_transfer",paymentId:"operator-"+crypto.randomUUID(),approvedBy:"operator-portal"});
  }
  if(action==="reject" && invoice.status==="pending"){
    await db.prepare("UPDATE media_invoices SET status='rejected',approved_by='operator-portal',updated_at=datetime('now') WHERE id=?").bind(invoiceId).run();
  }
  return NextResponse.redirect(new URL("/operator?saved=invoice",request.url),303);
}
