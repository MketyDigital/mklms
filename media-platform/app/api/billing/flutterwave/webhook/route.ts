import { NextResponse } from "next/server";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";
import { retrieveFlutterwaveV4Charge,verifyFlutterwaveV4Webhook,verifyMketyPaymentAttestation } from "../../../../../src/billing/flutterwave";
import { settleInvoice } from "../../../../../src/billing/settle";

export async function POST(request:Request){
  const env=getMediaEnv() as any;
  const rawBody=await request.text();
  const payload=JSON.parse(rawBody||"null") as any;

  const clientId=String(env.FLUTTERWAVE_CLIENT_ID||"");
  const clientSecret=String(env.FLUTTERWAVE_CLIENT_SECRET||"");
  const webhookSecret=String(env.FLUTTERWAVE_WEBHOOK_SECRET||"");
  const brokerSecret=String(env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET||"");

  const v4Signature=request.headers.get("flutterwave-signature")||"";
  const standardSignature=request.headers.get("verif-hash")||"";
  const brokerAttestation=request.headers.get("x-mkety-payment-attestation")||"";

  let reference="";
  let eventId="";
  let verified:any=null;

  if(v4Signature){
    if(!clientId||!clientSecret||!webhookSecret) return NextResponse.json({ok:false},{status:503});
    if(!(await verifyFlutterwaveV4Webhook(rawBody,v4Signature,webhookSecret))) return NextResponse.json({ok:false},{status:401});
    if(String(payload?.type||"")!=="charge.completed") return NextResponse.json({ok:true,settled:false});
    const chargeId=String(payload?.data?.id||"");
    if(!chargeId) return NextResponse.json({ok:false},{status:400});
    verified=await retrieveFlutterwaveV4Charge(clientId,clientSecret,chargeId);
    if(!verified||String(verified.status)!=="succeeded") return NextResponse.json({ok:true,settled:false});
    reference=String(verified.reference||"");
    eventId=String(payload?.id||chargeId);
  } else if(standardSignature){
    // Standard/v3 checkout events are verified and re-queried by the central Mkety webhook.
    // Media receives the original Flutterwave body/signature plus this broker HMAC attestation.
    if(!brokerSecret||!brokerAttestation) return NextResponse.json({ok:false},{status:401});
    if(!(await verifyMketyPaymentAttestation(rawBody,brokerAttestation,brokerSecret))) return NextResponse.json({ok:false},{status:401});
    if(String(payload?.event||"")!=="charge.completed") return NextResponse.json({ok:true,settled:false});
    const data=payload?.data||{};
    if(String(data.status||"")!=="successful") return NextResponse.json({ok:true,settled:false});
    reference=String(data.tx_ref||"");
    eventId=String(data.id||"");
    verified={
      reference,
      currency:String(data.currency||""),
      amount:Number(data.amount??data.charged_amount??0),
      status:"succeeded",
    };
    if(!reference||!eventId) return NextResponse.json({ok:false},{status:400});
  } else {
    return NextResponse.json({ok:false},{status:401});
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
