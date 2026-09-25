import { NextResponse } from "next/server";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";
import { retrieveFlutterwaveV4Charge,verifyFlutterwaveV3Transaction,verifyFlutterwaveV4Webhook } from "../../../../../src/billing/flutterwave";
import { settleInvoice } from "../../../../../src/billing/settle";

export async function POST(request:Request){
  const env=getMediaEnv() as any;
  const rawBody=await request.text();
  const payload=JSON.parse(rawBody||"null") as any;

  const clientId=String(env.FLUTTERWAVE_CLIENT_ID||"");
  const clientSecret=String(env.FLUTTERWAVE_CLIENT_SECRET||"");
  const webhookSecret=String(env.FLUTTERWAVE_WEBHOOK_SECRET||"");
  const v4Signature=request.headers.get("flutterwave-signature")||"";

  let reference="";
  let eventId="";
  let verified:any=null;

  if(clientId&&clientSecret&&webhookSecret&&v4Signature){
    const valid=await verifyFlutterwaveV4Webhook(rawBody,v4Signature,webhookSecret);
    if(!valid) return NextResponse.json({ok:false},{status:401});
    if(String(payload?.type||"")!=="charge.completed") return NextResponse.json({ok:true,settled:false});
    const chargeId=String(payload?.data?.id||"");
    if(!chargeId) return NextResponse.json({ok:false},{status:400});
    verified=await retrieveFlutterwaveV4Charge(clientId,clientSecret,chargeId);
    if(!verified||String(verified.status)!=="succeeded") return NextResponse.json({ok:true,settled:false});
    reference=String(verified.reference||"");
    eventId=String(payload?.id||chargeId);
  } else {
    const legacySecret=String(env.FLUTTERWAVE_V3_SECRET_KEY||"");
    const legacyHash=String(env.FLUTTERWAVE_V3_SECRET_HASH||"");
    const signature=request.headers.get("verif-hash")||"";
    if(!legacySecret||!legacyHash||signature!==legacyHash) return NextResponse.json({ok:false},{status:401});
    const transactionId=payload?.data?.id;
    if(!transactionId) return NextResponse.json({ok:true,settled:false});
    verified=await verifyFlutterwaveV3Transaction(legacySecret,transactionId);
    if(!verified||String(verified.status)!=="successful") return NextResponse.json({ok:true,settled:false});
    reference=String(verified.tx_ref||"");
    eventId=String(transactionId);
  }

  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,amount_usd,checkout_amount,checkout_currency,status FROM media_invoices WHERE reference=? LIMIT 1").bind(reference).first<any>();
  if(!invoice) return NextResponse.json({ok:false},{status:404});
  const expectedCurrency=String(invoice.checkout_currency||"USD").toUpperCase();
  const expectedAmount=Number(invoice.checkout_amount??invoice.amount_usd);
  if(String(verified.currency||"").toUpperCase()!==expectedCurrency) return NextResponse.json({ok:false,message:"currency mismatch"},{status:400});
  if(Number(verified.amount||0)+0.01<expectedAmount) return NextResponse.json({ok:false,message:"amount mismatch"},{status:400});

  const existing=await db.prepare("SELECT id FROM media_payment_events WHERE provider='flutterwave' AND external_event_id=? LIMIT 1").bind(eventId).first();
  if(existing) return NextResponse.json({ok:true,settled:true,duplicate:true});

  await db.prepare("INSERT INTO media_payment_events (id,invoice_id,provider,external_event_id,event_type) VALUES (?,?,'flutterwave',?,'successful')")
    .bind(crypto.randomUUID(),String(invoice.id),eventId).run();
  await settleInvoice({invoiceId:String(invoice.id),provider:"flutterwave",paymentId:eventId});
  return NextResponse.json({ok:true,settled:true});
}
