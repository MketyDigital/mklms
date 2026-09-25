import { NextResponse } from "next/server";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";
import { verifyKoraCharge,verifyKoraWebhook } from "../../../../../src/billing/kora";
import { settleInvoice } from "../../../../../src/billing/settle";

export async function POST(request:Request){
  const env=getMediaEnv() as any;
  const secretKey=String(env.KORA_SECRET_KEY||"");
  const signature=request.headers.get("x-korapay-signature")||"";
  if(!secretKey || !signature) return NextResponse.json({ok:false},{status:401});

  const payload=await request.json().catch(()=>null) as any;
  if(!payload?.data || !(await verifyKoraWebhook(payload.data,signature,secretKey))) {
    return NextResponse.json({ok:false},{status:401});
  }
  if(String(payload.event||"")!=="charge.success") return NextResponse.json({ok:true,settled:false});

  const reference=String(payload.data.reference||"");
  if(!reference) return NextResponse.json({ok:false},{status:400});
  const verified=await verifyKoraCharge(secretKey,reference);
  if(!verified || String(verified.status)!=="success") return NextResponse.json({ok:true,settled:false});

  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,amount_usd,status FROM media_invoices WHERE reference=? LIMIT 1").bind(reference).first<any>();
  if(!invoice) return NextResponse.json({ok:false},{status:404});
  if(String(verified.currency||"").toUpperCase()!=="USD") return NextResponse.json({ok:false,message:"currency mismatch"},{status:400});
  const paid=Number(verified.amount_paid??verified.amount??0);
  if(paid+0.01<Number(invoice.amount_usd)) return NextResponse.json({ok:false,message:"amount mismatch"},{status:400});

  const eventId=String(verified.transaction_reference||verified.reference||reference);
  const existing=await db.prepare("SELECT id FROM media_payment_events WHERE provider='kora' AND external_event_id=? LIMIT 1").bind(eventId).first();
  if(existing) return NextResponse.json({ok:true,settled:true,duplicate:true});

  await db.prepare("INSERT INTO media_payment_events (id,invoice_id,provider,external_event_id,event_type) VALUES (?,?,'kora',?,'success')")
    .bind(crypto.randomUUID(),String(invoice.id),eventId).run();
  await settleInvoice({invoiceId:String(invoice.id),provider:"kora",paymentId:eventId});
  return NextResponse.json({ok:true,settled:true});
}
