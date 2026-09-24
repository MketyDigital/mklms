import { NextResponse } from "next/server";
import { getMediaDb } from "../../../../src/lib/postgres";
import {
  telegram,
  telegramConfig,
  telegramDisplayName,
  telegramMessageId,
} from "../../../../src/billing/telegram";
import { settleInvoice } from "../../../../src/billing/settle";

function isPrivate(message:any){
  return String(message?.chat?.type||"")==="private";
}

function command(text:string){
  return text.trim().split(/\s+/)[0].replace(/@[^\s]+$/,"").toLowerCase();
}

function startPayload(text:string){
  const parts=text.trim().split(/\s+/);
  return parts.length>1?parts.slice(1).join(" ").trim():"";
}

function customerMenu(){
  return {
    inline_keyboard:[
      [{text:"💬 General support",callback_data:"support:general"}],
      [{text:"🏢 Enterprise support",callback_data:"support:enterprise"}],
      [{text:"🧾 Submit payment proof",callback_data:"proof:start"}],
    ],
  };
}

async function upsertContact(message:any,state?:string,supportMode?:string,invoiceId?:string|null){
  const db=getMediaDb();
  const chatId=String(message.chat.id);
  const from=message.from||{};
  await db.prepare(
    "INSERT INTO media_telegram_contacts (chat_id,telegram_user_id,username,first_name,last_name,state,invoice_id,support_mode,last_seen_at) VALUES (?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(chat_id) DO UPDATE SET telegram_user_id=excluded.telegram_user_id,username=excluded.username,first_name=excluded.first_name,last_name=excluded.last_name,state=COALESCE(?,media_telegram_contacts.state),invoice_id=CASE WHEN ?=1 THEN ? ELSE media_telegram_contacts.invoice_id END,support_mode=COALESCE(?,media_telegram_contacts.support_mode),last_seen_at=datetime('now')"
  ).bind(
    chatId,
    String(from.id||""),
    from.username?String(from.username):null,
    from.first_name?String(from.first_name):null,
    from.last_name?String(from.last_name):null,
    state||"support",
    invoiceId??null,
    supportMode||"general",
    state??null,
    invoiceId!==undefined?1:0,
    invoiceId??null,
    supportMode??null,
  ).run();
}

async function setContactState(chatId:string,state:string,invoiceId:string|null,supportMode?:string){
  await getMediaDb().prepare(
    "UPDATE media_telegram_contacts SET state=?,invoice_id=?,support_mode=COALESCE(?,support_mode),last_seen_at=datetime('now') WHERE chat_id=?"
  ).bind(state,invoiceId,supportMode??null,chatId).run();
}

async function sendWelcome(chatId:string){
  await telegram("sendMessage",{
    chat_id:chatId,
    text:"Welcome to Mkety Media Support.\n\nYou can chat with our team here, request Enterprise help, or submit proof for a bank-transfer invoice.",
    reply_markup:customerMenu(),
  });
}

async function invoiceByReference(reference:string){
  return getMediaDb().prepare(
    "SELECT i.id,i.reference,i.amount_usd,i.amount_local,i.local_currency,i.status,t.name AS tenant_name FROM media_invoices i JOIN media_tenants t ON t.id=i.tenant_id WHERE upper(i.reference)=upper(?) LIMIT 1"
  ).bind(reference.trim()).first<any>();
}

async function beginProofForInvoice(chatId:string,invoice:any){
  if(!invoice){
    await telegram("sendMessage",{chat_id:chatId,text:"I could not find that invoice. Please check the reference and try again."});
    return false;
  }
  if(String(invoice.status)!=="pending"){
    await telegram("sendMessage",{chat_id:chatId,text:"That invoice is not awaiting payment. Current status: "+String(invoice.status)+"."});
    return false;
  }
  await setContactState(chatId,"awaiting_proof",String(invoice.id));
  const amount=invoice.amount_local!=null
    ? String(invoice.local_currency||"")+" "+Number(invoice.amount_local).toLocaleString()
    : "USD $"+Number(invoice.amount_usd).toFixed(2);
  await telegram("sendMessage",{
    chat_id:chatId,
    text:"Invoice found: "+String(invoice.reference)+"\nAmount: "+amount+"\n\nPlease send the payment proof now as a photo or document. Our operator will verify the actual bank credit before approving it.",
    reply_markup:{force_reply:true,input_field_placeholder:"Send screenshot or payment document"},
  });
  return true;
}

async function saveRelay(operatorChatId:string,operatorMessageId:number,customerChatId:string,customerMessageId:number|null,kind:string){
  if(!operatorMessageId) return;
  await getMediaDb().prepare(
    "INSERT OR IGNORE INTO media_telegram_relays (id,operator_chat_id,operator_message_id,customer_chat_id,customer_message_id,relay_kind) VALUES (?,?,?,?,?,?)"
  ).bind(crypto.randomUUID(),operatorChatId,operatorMessageId,customerChatId,customerMessageId,kind).run();
}

async function relaySupportMessage(message:any){
  const cfg=telegramConfig();
  const chatId=String(message.chat.id);
  if(!cfg.chatId){
    await telegram("sendMessage",{chat_id:chatId,text:"Mkety support inbox is still being configured. Please try again shortly."});
    return;
  }

  const contact=await getMediaDb().prepare(
    "SELECT support_mode FROM media_telegram_contacts WHERE chat_id=? LIMIT 1"
  ).bind(chatId).first<any>();
  const mode=String(contact?.support_mode||"general");
  const from=message.from||{};
  const username=from.username?"@"+String(from.username):"none";
  const header=await telegram("sendMessage",{
    chat_id:cfg.chatId,
    text:"📩 Mkety Media "+(mode==="enterprise"?"Enterprise":"Support")+"\n"+
      "Customer: "+telegramDisplayName(from)+"\n"+
      "Telegram: "+username+"\n"+
      "User ID: "+String(from.id||"")+"\n"+
      "Chat ID: "+chatId+"\n\nReply to this header or the copied message to answer the customer.",
  });
  const headerId=telegramMessageId(header);
  await saveRelay(cfg.chatId,headerId,chatId,Number(message.message_id||0)||null,"support");

  const copied=await telegram("copyMessage",{
    chat_id:cfg.chatId,
    from_chat_id:chatId,
    message_id:Number(message.message_id),
    reply_parameters:headerId?{message_id:headerId}:undefined,
  });
  const copiedId=telegramMessageId(copied);
  await saveRelay(cfg.chatId,copiedId,chatId,Number(message.message_id||0)||null,"support");

  await telegram("sendMessage",{chat_id:chatId,text:"✅ Your message has been sent to Mkety Support. A team member can reply to you here."});
}

async function submitProof(message:any){
  const cfg=telegramConfig();
  const chatId=String(message.chat.id);
  if(!cfg.chatId){
    await telegram("sendMessage",{chat_id:chatId,text:"Payment-proof review is still being configured. Please try again shortly."});
    return;
  }

  const contact=await getMediaDb().prepare(
    "SELECT invoice_id FROM media_telegram_contacts WHERE chat_id=? LIMIT 1"
  ).bind(chatId).first<any>();
  const invoiceId=String(contact?.invoice_id||"");
  if(!invoiceId){
    await setContactState(chatId,"awaiting_invoice",null);
    await telegram("sendMessage",{chat_id:chatId,text:"Please send your invoice reference first, for example MKM-XXXXXXXXXX."});
    return;
  }

  const hasProof=Array.isArray(message.photo)&&message.photo.length>0 || Boolean(message.document);
  if(!hasProof){
    await telegram("sendMessage",{chat_id:chatId,text:"Please send the payment proof as a photo or document."});
    return;
  }

  const invoice=await getMediaDb().prepare(
    "SELECT i.id,i.reference,i.amount_usd,i.amount_local,i.local_currency,i.status,t.name AS tenant_name FROM media_invoices i JOIN media_tenants t ON t.id=i.tenant_id WHERE i.id=? LIMIT 1"
  ).bind(invoiceId).first<any>();
  if(!invoice || String(invoice.status)!=="pending"){
    await setContactState(chatId,"support",null);
    await telegram("sendMessage",{chat_id:chatId,text:"That invoice is no longer awaiting payment. Please open Billing for the current invoice."});
    return;
  }

  const proofId=crypto.randomUUID();
  const amount=invoice.amount_local!=null
    ? String(invoice.local_currency||"")+" "+Number(invoice.amount_local).toLocaleString()
    : "USD $"+Number(invoice.amount_usd).toFixed(2);
  const from=message.from||{};

  const summary=await telegram("sendMessage",{
    chat_id:cfg.chatId,
    text:"🧾 Payment proof received\n\n"+
      "Customer: "+String(invoice.tenant_name)+"\n"+
      "Telegram: "+telegramDisplayName(from)+(from.username?" (@"+String(from.username)+")":"")+"\n"+
      "Invoice: "+String(invoice.reference)+"\n"+
      "Amount: "+amount+"\n\n"+
      "Verify the actual bank credit before approving.",
    reply_markup:{inline_keyboard:[
      [{text:"✅ Approve payment",callback_data:"proof:approve:"+proofId}],
      [{text:"❌ Reject proof",callback_data:"proof:reject:"+proofId}],
    ]},
  });
  const summaryId=telegramMessageId(summary);

  const copied=await telegram("copyMessage",{
    chat_id:cfg.chatId,
    from_chat_id:chatId,
    message_id:Number(message.message_id),
    reply_parameters:summaryId?{message_id:summaryId}:undefined,
  });
  const proofMessageId=telegramMessageId(copied);

  await getMediaDb().batch([
    getMediaDb().prepare(
      "INSERT INTO media_telegram_payment_proofs (id,invoice_id,customer_chat_id,customer_message_id,operator_summary_message_id,operator_proof_message_id,status) VALUES (?,?,?,?,?,?,'pending')"
    ).bind(proofId,String(invoice.id),chatId,Number(message.message_id),summaryId||null,proofMessageId||null),
    getMediaDb().prepare(
      "UPDATE media_telegram_contacts SET state='support',invoice_id=NULL,last_seen_at=datetime('now') WHERE chat_id=?"
    ).bind(chatId),
  ]);

  await saveRelay(cfg.chatId,summaryId,chatId,Number(message.message_id),"payment");
  await saveRelay(cfg.chatId,proofMessageId,chatId,Number(message.message_id),"payment");

  await telegram("sendMessage",{
    chat_id:chatId,
    text:"✅ Proof received for "+String(invoice.reference)+". Mkety will verify the payment and notify you here when it is approved or if a clearer proof is needed.",
  });
}

async function handleCustomerCallback(callback:any){
  const chatId=String(callback?.message?.chat?.id||"");
  if(!chatId) return;
  const data=String(callback.data||"");
  await telegram("answerCallbackQuery",{callback_query_id:callback.id}).catch(()=>undefined);

  if(data==="proof:start"){
    await upsertContact({chat:{id:chatId},from:callback.from},"awaiting_invoice","general",null);
    await telegram("sendMessage",{
      chat_id:chatId,
      text:"Send your Mkety invoice reference, for example MKM-XXXXXXXXXX.",
      reply_markup:{force_reply:true,input_field_placeholder:"MKM-XXXXXXXXXX"},
    });
    return;
  }

  if(data==="support:general" || data==="support:enterprise"){
    const mode=data.endsWith("enterprise")?"enterprise":"general";
    await upsertContact({chat:{id:chatId},from:callback.from},"support",mode,undefined);
    await telegram("sendMessage",{
      chat_id:chatId,
      text:mode==="enterprise"
        ?"Tell us what you need for your Enterprise setup. Your message will go directly to the Mkety operator team."
        :"Send your question or screenshot here. It will go directly to the Mkety operator team.",
      reply_markup:{force_reply:true,input_field_placeholder:"Type your message"},
    });
  }
}

async function handleProofCallback(callback:any){
  const cfg=telegramConfig();
  const operatorId=String(callback.from?.id||"");
  if(!cfg.operatorIds.includes(operatorId)){
    await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Not authorized",show_alert:true}).catch(()=>undefined);
    return;
  }

  const data=String(callback.data||"");
  const match=data.match(/^proof:(approve|reject):(.+)$/);
  if(!match) return;
  const action=match[1];
  const proofId=match[2];

  const proof=await getMediaDb().prepare(
    "SELECT p.id,p.invoice_id,p.customer_chat_id,p.status,i.reference,i.status AS invoice_status FROM media_telegram_payment_proofs p JOIN media_invoices i ON i.id=p.invoice_id WHERE p.id=? LIMIT 1"
  ).bind(proofId).first<any>();
  if(!proof){
    await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Proof not found",show_alert:true}).catch(()=>undefined);
    return;
  }
  if(String(proof.status)!=="pending"){
    await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Already reviewed"}).catch(()=>undefined);
    return;
  }

  if(action==="approve"){
    if(String(proof.invoice_status)==="pending"){
      await settleInvoice({
        invoiceId:String(proof.invoice_id),
        provider:"bank_transfer",
        paymentId:"telegram-proof-"+proofId,
        approvedBy:"telegram:"+operatorId,
      });
    }
    await getMediaDb().prepare(
      "UPDATE media_telegram_payment_proofs SET status='approved',reviewed_by=?,reviewed_at=datetime('now') WHERE id=?"
    ).bind("telegram:"+operatorId,proofId).run();

    await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Payment approved"}).catch(()=>undefined);
    if(callback.message?.chat?.id && callback.message?.message_id){
      await telegram("editMessageText",{
        chat_id:callback.message.chat.id,
        message_id:callback.message.message_id,
        text:"✅ Payment approved\nInvoice: "+String(proof.reference)+"\nApproved by operator "+operatorId,
        reply_markup:{inline_keyboard:[]},
      }).catch(()=>undefined);
    }
    await telegram("sendMessage",{
      chat_id:String(proof.customer_chat_id),
      text:"✅ Payment approved for "+String(proof.reference)+". Your Mkety Media purchase/account is now active.",
    }).catch(()=>undefined);
    return;
  }

  await getMediaDb().prepare(
    "UPDATE media_telegram_payment_proofs SET status='rejected',reviewed_by=?,reviewed_at=datetime('now') WHERE id=?"
  ).bind("telegram:"+operatorId,proofId).run();
  await setContactState(String(proof.customer_chat_id),"awaiting_proof",String(proof.invoice_id));

  await telegram("answerCallbackQuery",{callback_query_id:callback.id,text:"Proof rejected"}).catch(()=>undefined);
  if(callback.message?.chat?.id && callback.message?.message_id){
    await telegram("editMessageText",{
      chat_id:callback.message.chat.id,
      message_id:callback.message.message_id,
      text:"❌ Proof rejected\nInvoice: "+String(proof.reference)+"\nCustomer may submit a clearer/correct proof.",
      reply_markup:{inline_keyboard:[]},
    }).catch(()=>undefined);
  }
  await telegram("sendMessage",{
    chat_id:String(proof.customer_chat_id),
    text:"❌ We could not approve the proof for "+String(proof.reference)+". Please send a clearer or correct payment proof here. Your invoice remains open.",
  }).catch(()=>undefined);
}

async function handleOperatorReply(message:any){
  const cfg=telegramConfig();
  if(String(message.chat?.id||"")!==cfg.chatId) return;
  const operatorId=String(message.from?.id||"");
  if(!cfg.operatorIds.includes(operatorId)) return;
  const repliedId=Number(message.reply_to_message?.message_id||0);
  if(!repliedId) return;

  const relay=await getMediaDb().prepare(
    "SELECT customer_chat_id FROM media_telegram_relays WHERE operator_chat_id=? AND operator_message_id=? LIMIT 1"
  ).bind(cfg.chatId,repliedId).first<any>();
  if(!relay) return;

  try{
    await telegram("copyMessage",{
      chat_id:String(relay.customer_chat_id),
      from_chat_id:cfg.chatId,
      message_id:Number(message.message_id),
    });
  }catch{
    if(message.text){
      await telegram("sendMessage",{chat_id:String(relay.customer_chat_id),text:String(message.text)});
    }
  }
}

async function handleMessage(message:any){
  const cfg=telegramConfig();
  const text=String(message.text||message.caption||"");
  const cmd=command(text);

  if(cmd==="/whoami"){
    await telegram("sendMessage",{
      chat_id:String(message.chat.id),
      text:"Your Telegram user ID is:\n"+String(message.from?.id||"")+"\n\nUse this number in MEDIA_TELEGRAM_OPERATOR_IDS if this account should be allowed to approve/reject payments and answer customers.",
    });
    return;
  }

  if(cmd==="/groupid"){
    await telegram("sendMessage",{
      chat_id:String(message.chat.id),
      text:"This chat ID is:\n"+String(message.chat.id)+"\n\nUse it as MEDIA_TELEGRAM_CHAT_ID for the Mkety Media operator inbox.",
    });
    return;
  }

  if(String(message.chat?.id||"")===cfg.chatId && !isPrivate(message)){
    await handleOperatorReply(message);
    return;
  }

  if(!isPrivate(message)) return;

  const chatId=String(message.chat.id);
  await upsertContact(message);

  if(cmd==="/start"){
    const payload=startPayload(text);
    const proofMatch=payload.match(/^pay_(MKM-[A-Za-z0-9]+)$/i);
    if(proofMatch){
      const invoice=await invoiceByReference(proofMatch[1]);
      if(await beginProofForInvoice(chatId,invoice)) return;
    }
    if(payload==="enterprise"){
      await setContactState(chatId,"support",null,"enterprise");
      await telegram("sendMessage",{
        chat_id:chatId,
        text:"Tell us what you need for your Enterprise setup. Your message will go directly to the Mkety operator team.",
        reply_markup:{force_reply:true,input_field_placeholder:"Describe your Enterprise requirements"},
      });
      return;
    }
    await sendWelcome(chatId);
    return;
  }

  if(cmd==="/pay"){
    const parts=text.trim().split(/\s+/);
    if(parts[1]){
      const invoice=await invoiceByReference(parts[1]);
      if(await beginProofForInvoice(chatId,invoice)) return;
    }
    await setContactState(chatId,"awaiting_invoice",null);
    await telegram("sendMessage",{chat_id:chatId,text:"Send your invoice reference, for example MKM-XXXXXXXXXX."});
    return;
  }

  const contact=await getMediaDb().prepare(
    "SELECT state,invoice_id,support_mode FROM media_telegram_contacts WHERE chat_id=? LIMIT 1"
  ).bind(chatId).first<any>();

  if(String(contact?.state)==="awaiting_invoice"){
    if(!text){
      await telegram("sendMessage",{chat_id:chatId,text:"Please send the invoice reference as text first."});
      return;
    }
    const invoice=await invoiceByReference(text.trim());
    if(await beginProofForInvoice(chatId,invoice)) return;
    return;
  }

  if(String(contact?.state)==="awaiting_proof"){
    await submitProof(message);
    return;
  }

  await relaySupportMessage(message);
}

export async function POST(request:Request){
  const cfg=telegramConfig();
  const provided=request.headers.get("x-telegram-bot-api-secret-token")||"";
  if(!cfg.webhookSecret || provided!==cfg.webhookSecret){
    return NextResponse.json({ok:false},{status:401});
  }

  const update=await request.json().catch(()=>null) as any;
  try{
    if(update?.callback_query){
      const callback=update.callback_query;
      const callbackChatId=String(callback?.message?.chat?.id||"");
      if(callbackChatId && callbackChatId===cfg.chatId){
        await handleProofCallback(callback);
      }else{
        await handleCustomerCallback(callback);
      }
      return NextResponse.json({ok:true});
    }

    if(update?.message){
      await handleMessage(update.message);
      return NextResponse.json({ok:true});
    }

    return NextResponse.json({ok:true});
  }catch(error){
    console.error("Telegram webhook error",error);
    return NextResponse.json({ok:true});
  }
}
