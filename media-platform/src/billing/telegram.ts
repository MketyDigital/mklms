import { getMediaEnv } from "../lib/postgres";

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
