import { NextResponse } from "next/server";
import { getMediaDb } from "../../../../src/lib/postgres";
import { telegram,telegramConfig } from "../../../../src/billing/telegram";
import { allowAuthAttempt } from "../../../../src/lib/rate-limit";

export async function POST(request:Request){
  const form=await request.formData();
  const companyName=String(form.get("companyName")||"").trim();
  const contactName=String(form.get("contactName")||"").trim();
  const telegramContact=String(form.get("telegramContact")||"").trim();
  const requirements=String(form.get("requirements")||"").trim();

  if(!companyName||!contactName||!telegramContact) return NextResponse.redirect(new URL("/enterprise?error=invalid",request.url),303);
  if(!(await allowAuthAttempt("enterprise:"+telegramContact))) return NextResponse.redirect(new URL("/enterprise?error=rate",request.url),303);

  const id=crypto.randomUUID();
  await getMediaDb().prepare(
    "INSERT INTO media_enterprise_requests (id,company_name,contact_name,telegram_contact,requirements) VALUES (?,?,?,?,?)"
  ).bind(id,companyName,contactName,telegramContact,requirements||null).run();

  const cfg=telegramConfig();
  if(cfg.token&&cfg.chatId){
    await telegram("sendMessage",{
      chat_id:cfg.chatId,
      text:"New Mkety Media Enterprise request\n\nCompany: "+companyName+"\nContact: "+contactName+"\nTelegram: "+telegramContact+"\n\nNeeds:\n"+(requirements||"Not specified"),
    }).catch((error)=>console.error(error));
  }
  return NextResponse.redirect(new URL("/enterprise?submitted=1",request.url),303);
}
