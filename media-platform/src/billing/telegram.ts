import { getMediaEnv } from "../lib/postgres";

export function telegramConfig(){
  const env=getMediaEnv() as any;
  return {
    token:String(env.MEDIA_TELEGRAM_BOT_TOKEN||""),
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
  if(!response.ok) throw new Error("Telegram request failed");
  return response.json().catch(()=>null);
}
