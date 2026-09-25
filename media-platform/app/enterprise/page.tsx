import Link from "next/link";
import { getSetting } from "../../src/lib/operator-settings";
import { getMediaEnv } from "../../src/lib/postgres";

export const dynamic = "force-dynamic";

export default async function EnterprisePage(){
  const portal=await getSetting<any>("portal_content",{
    enterpriseTitle:"Need a custom plan?",
    enterpriseText:"Tell us what you need and our team will prepare a plan for your business.",
  });
  const runtime=getMediaEnv() as any;
  const botUsername=String(runtime.MEDIA_TELEGRAM_BOT_USERNAME||"");

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/">Home</Link><Link href="/trust">Security & reliability</Link><Link href="/login">Login</Link></div></nav>
    <div className="card form">
      <h1>{String(portal.enterpriseTitle||"Enterprise")}</h1>
      <p className="muted">{String(portal.enterpriseText||"Tell us what you need.")}</p>
      <form method="post" action="/api/enterprise/request">
        <label>Company / project name</label><input name="companyName" required maxLength={100}/>
        <label>Your name</label><input name="contactName" required maxLength={100}/>
        <label>Telegram username or contact</label><input name="telegramContact" required maxLength={100} placeholder="@username"/>
        <label>Tell us what you need</label><textarea name="requirements" rows={6} maxLength={3000} style={{width:"100%",padding:12}} placeholder="Storage, monthly delivery, team size, branded domain, region or other requirements"/>
        <button className="btn">Request a custom plan</button>
      </form>
      {botUsername&&<p style={{marginTop:18}}><a className="btn secondary" href={"https://t.me/"+botUsername+"?start=enterprise"} target="_blank">Chat with our team on Telegram</a></p>}
    </div>
  </main>;
}
