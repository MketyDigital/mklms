import { getMediaDb } from "../lib/postgres";

function addMonths(date:Date,months:number){
  const next=new Date(date);
  const day=next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth()+months);
  const maxDay=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
  next.setUTCDate(Math.min(day,maxDay));
  return next;
}

export async function settleInvoice(input:{
  invoiceId:string;
  provider:"nowpayments"|"bank_transfer";
  paymentId:string;
  approvedBy?:string;
}){
  const db=getMediaDb();
  const invoice=await db.prepare(
    "SELECT i.id,i.tenant_id,i.status,c.billing_term_months,s.current_period_end FROM media_invoices i LEFT JOIN media_tenant_commercial_terms c ON c.tenant_id=i.tenant_id LEFT JOIN media_subscriptions s ON s.tenant_id=i.tenant_id WHERE i.id=? LIMIT 1"
  ).bind(input.invoiceId).first<any>();
  if(!invoice) throw new Error("Invoice not found");
  if(invoice.status==="paid") return {ok:true,alreadyPaid:true};
  if(invoice.status!=="pending") throw new Error("Invoice is not payable");

  const months=Number(invoice.billing_term_months||1);
  const existingEnd=invoice.current_period_end?new Date(String(invoice.current_period_end)):null;
  const base=existingEnd && existingEnd.getTime()>Date.now()?existingEnd:new Date();
  const periodEnd=addMonths(base,months).toISOString();
  const now=new Date().toISOString();

  await db.batch([
    db.prepare("UPDATE media_invoices SET status='paid',payment_method=?,provider_payment_id=?,paid_at=?,approved_by=?,updated_at=? WHERE id=? AND status='pending'")
      .bind(input.provider,input.paymentId,now,input.approvedBy||null,now,input.invoiceId),
    db.prepare("UPDATE media_tenants SET status='active' WHERE id=?").bind(String(invoice.tenant_id)),
    db.prepare("UPDATE media_subscriptions SET status='active',payment_provider=?,current_period_end=?,updated_at=? WHERE tenant_id=?")
      .bind(input.provider,periodEnd,now,String(invoice.tenant_id)),
    db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id,metadata_json) VALUES (?,?,'payment',?,'invoice.settled','invoice',?,?)")
      .bind(crypto.randomUUID(),String(invoice.tenant_id),input.approvedBy||input.provider,input.invoiceId,JSON.stringify({provider:input.provider,paymentId:input.paymentId})),
  ]);
  return {ok:true,alreadyPaid:false,tenantId:String(invoice.tenant_id),periodEnd};
}
