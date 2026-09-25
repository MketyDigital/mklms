import { NextResponse } from "next/server";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";
import { verifyFlutterwaveTransaction } from "../../../../../src/billing/flutterwave";
import { settleInvoice } from "../../../../../src/billing/settle";

export async function POST(request:Request){
  const env=getMediaEnv() as any;
  const secretKey=String(env.FLUTTERWAVE_SECRET_KEY||"");
  const secretHash=String(env.FLUTTERWAVE_SECRET_HASH||"");
  const signature=request.headers.get("verif-hash")||"";
  if(!secretKey || !secretHash || signature!==secretHash) return NextResponse.json({ok:false},{status:401});

  const payload=await request.json().catch(()=>null) as any;
  const transactionId=payload?.data?.id;
  if(!transactionId) return NextResponse.json({ok:true,settled:false});

  const verified=await verifyFlutterwaveTransaction(secretKey,transactionId);
  if(!verified || String(verified.status)!=="successful") return NextResponse.json({ok:true,settled:false});

  const reference=String(verified.tx_ref||"");
  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,amount_usd,status FROM media_invoices WHERE reference=? LIMIT 1").bind(reference).first<any>();
  if(!invoice) return NextResponse.json({ok:false},{status:404});
  if(String(verified.currency||"").toUpperCase()!=="USD") return NextResponse.json({ok:false,message:"currency mismatch"},{status:400});
  if(Number(verified.amount||0)+0.01<Number(invoice.amount_usd)) return NextResponse.json({ok:false,message:"amount mismatch"},{status:400});

  const eventId=String(transactionId);
  const existing=await db.prepare("SELECT id FROM media_payment_events WHERE provider='flutterwave' AND external_event_id=? LIMIT 1").bind(eventId).first();
  if(existing) return NextResponse.json({ok:true,settled:true,duplicate:true});

  await db.prepare("INSERT INTO media_payment_events (id,invoice_id,provider,external_event_id,event_type) VALUES (?,?,'flutterwave',?,'successful')")
    .bind(crypto.randomUUID(),String(invoice.id),eventId).run();
  await settleInvoice({invoiceId:String(invoice.id),provider:"flutterwave",paymentId:eventId});
  return NextResponse.json({ok:true,settled:true});
}
