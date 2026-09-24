import { NextResponse } from "next/server";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";
import { verifyNowPaymentsSignature } from "../../../../../src/billing/nowpayments";
import { settleInvoice } from "../../../../../src/billing/settle";

export async function POST(request:Request){
  const env=getMediaEnv() as any;
  const secret=String(env.NOWPAYMENTS_IPN_SECRET||"");
  const signature=request.headers.get("x-nowpayments-sig")||"";
  if(!secret || !signature) return NextResponse.json({ok:false},{status:401});

  const payload=await request.json().catch(()=>null) as any;
  if(!payload || !(await verifyNowPaymentsSignature(payload,signature,secret))) {
    return NextResponse.json({ok:false},{status:401});
  }

  const status=String(payload.payment_status||"");
  if(status!=="finished") return NextResponse.json({ok:true,settled:false,status});

  const paymentId=String(payload.payment_id||"");
  const reference=String(payload.order_id||"");
  if(!paymentId || !reference) return NextResponse.json({ok:false},{status:400});

  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,amount_usd,status FROM media_invoices WHERE reference=? LIMIT 1").bind(reference).first<any>();
  if(!invoice) return NextResponse.json({ok:false},{status:404});
  if(Number(payload.price_amount||0)+0.01<Number(invoice.amount_usd)) return NextResponse.json({ok:false,message:"amount mismatch"},{status:400});

  const existing=await db.prepare("SELECT id FROM media_payment_events WHERE provider='nowpayments' AND external_event_id=? LIMIT 1").bind(paymentId).first();
  if(existing) return NextResponse.json({ok:true,settled:true,duplicate:true});

  await db.prepare("INSERT INTO media_payment_events (id,invoice_id,provider,external_event_id,event_type) VALUES (?,?,'nowpayments',?,'finished')")
    .bind(crypto.randomUUID(),String(invoice.id),paymentId).run();
  await settleInvoice({invoiceId:String(invoice.id),provider:"nowpayments",paymentId});
  return NextResponse.json({ok:true,settled:true});
}
