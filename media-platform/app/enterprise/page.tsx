import Link from "next/link";
import { getSetting } from "../../src/lib/operator-settings";

export const dynamic = "force-dynamic";

export default async function EnterprisePage(){
  const portal=await getSetting<any>("portal_content",{
    enterpriseTitle:"Need custom limits?",
    enterpriseText:"Tell us what you need and Mkety will prepare a private Enterprise offer.",
    enterpriseTelegramUrl:"",
  });
  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/">Home</Link><Link href="/login">Login</Link></div></nav>
    <div className="card form">
      <h1>{String(portal.enterpriseTitle||"Enterprise")}</h1>
      <p className="muted">{String(portal.enterpriseText||"Tell us what you need.")}</p>
      <form method="post" action="/api/enterprise/request">
        <label>Company / project name</label><input name="companyName" required maxLength={100}/>
        <label>Your name</label><input name="contactName" required maxLength={100}/>
        <label>Telegram username or contact</label><input name="telegramContact" required maxLength={100} placeholder="@username"/>
        <label>What do you need?</label><textarea name="requirements" rows={6} maxLength={3000} style={{width:"100%",padding:12}} placeholder="Storage size, delivery needs, region, team size, private/dedicated infrastructure, etc."/>
        <button className="btn">Request Enterprise setup</button>
      </form>
      {portal.enterpriseTelegramUrl&&<p className="muted" style={{marginTop:18}}>Prefer Telegram? <a href={String(portal.enterpriseTelegramUrl)} target="_blank">Talk to Mkety</a>.</p>}
    </div>
  </main>;
}
