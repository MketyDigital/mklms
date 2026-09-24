import { getMediaDb, getMediaEnv } from "../lib/postgres";

export function telegramConfig(){
  const env=getMediaEnv() as any;
  return {
    token:String(env.MEDIA_TELEGRAM_BOT_TOKEN||""),
    username:String(env.MEDIA_TELEGRAM_BOT_USERNAME||""),
    chatId:String(env.MEDIA_TELEGRAM_CHAT_ID||""),
    webhookSecret:String(env.MEDIA_TELEGRAM_WEBHOOK_SECRET||""),
    operatorIds:String(env.MEDIA_TELEGRAM_OPERATOR_IDS||"").split(",").map((v:string)=>v.trim()).filter(Boolean),
  };
}

export async function telegramOperatorChatId(){
  try{
    const row=await getMediaDb().prepare(
      "SELECT value_json FROM media_operator_settings WHERE key='telegram_operator_chat' LIMIT 1"
    ).first<any>();
    if(row?.value_json){
      const parsed=JSON.parse(String(row.value_json));
      if(parsed?.chatId) return String(parsed.chatId);
    }
  }catch{}
  return telegramConfig().chatId;
}

export async function bindTelegramOperatorChat(chatId:string,actorId:string){
  const value=JSON.stringify({chatId,boundBy:actorId,boundAt:new Date().toISOString()});
  await getMediaDb().prepare(
    "INSERT INTO media_operator_settings (key,value_json,updated_at,updated_by) VALUES ('telegram_operator_chat',?,datetime('now'),?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=datetime('now'),updated_by=excluded.updated_by"
  ).bind(value,"telegram:"+actorId).run();
}

export async function telegram(method:string,payload:Record<string,unknown>){
  const cfg=telegramConfig();
  if(!cfg.token) throw new Error("Telegram bot is not configured");
  const response=await fetch("https://api.telegram.org/bot"+cfg.token+"/"+method,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(payload),
  });
  const data=await response.json().catch(()=>null) as any;
  if(!response.ok || data?.ok===false){
    throw new Error("Telegram request failed: "+String(data?.description||response.status));
  }
  return data;
}

export function telegramMessageId(result:any){
  return Number(result?.result?.message_id||0);
}

export function telegramDisplayName(user:any){
  const name=[user?.first_name,user?.last_name].filter(Boolean).join(" ").trim();
  if(name) return name;
  if(user?.username) return "@"+String(user.username);
  return "Telegram user";
}
