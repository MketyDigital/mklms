import { NextResponse } from "next/server";
import { getMediaDb } from "../../../../src/lib/postgres";
import { telegram,telegramConfig } from "../../../../src/billing/telegram";
import { settleInvoice } from "../../../../src/billing/settle";

export async function POST(request:Request){
  const cfg=telegramConfig();
  const provided=request.headers.get("x-telegram-bot-api-secret-token")||"";
  if(!cfg.webhookSecret || provided!==cfg.webhookSecret) return NextResponse.json({ok:false},{status:401});

  const update=await request.json().catch(()=>null) as any;
  const callback=update?.callback_query;
  if(!callback) return NextResponse.json({ok:true});

  const operatorId=String(callback.from?.id||"");
  if(!cfg.operatorIds.includes(operatorId)) {
    await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Not authorized"}).catch(()=>undefined);
    return NextResponse.json({ok:true});
  }

  const data=String(callback.data||"");
  const [action,invoiceId]=data.split(":");
  if(!["approve","reject"].includes(action)||!invoiceId) return NextResponse.json({ok:true});

  const db=getMediaDb();
  const invoice=await db.prepare("SELECT id,reference,status FROM media_invoices WHERE id=? LIMIT 1").bind(invoiceId).first<any>();
  if(!invoice){
    await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Invoice not found"}).catch(()=>undefined);
    return NextResponse.json({ok:true});
  }

  if(action==="approve"){
    if(invoice.status==="pending"){
      await settleInvoice({invoiceId,provider:"bank_transfer",paymentId:"telegram-"+String(callback.id),approvedBy:"telegram:"+operatorId});
    }
    await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Payment approved"}).catch(()=>undefined);
    if(callback.message?.chat?.id && callback.message?.message_id){
      await telegram("editMessageText",{chat_id:callback.message.chat.id,message_id:callback.message.message_id,text:"✅ Mkety Media payment approved\nInvoice: "+String(invoice.reference)+"\nApproved by operator "+operatorId}).catch(()=>undefined);
    }
  }else{
    if(invoice.status==="pending"){
      await db.prepare("UPDATE media_invoices SET status='rejected',approved_by=?,updated_at=datetime('now') WHERE id=?").bind("telegram:"+operatorId,invoiceId).run();
    }
    await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Payment rejected"}).catch(()=>undefined);
    if(callback.message?.chat?.id && callback.message?.message_id){
      await telegram("editMessageText",{chat_id:callback.message.chat.id,message_id:callback.message.message_id,text:"❌ Mkety Media payment rejected\nInvoice: "+String(invoice.reference)}).catch(()=>undefined);
    }
  }

  return NextResponse.json({ok:true});
}
