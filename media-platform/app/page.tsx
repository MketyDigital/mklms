import Link from "next/link";
import { getPublicPlans } from "../src/lib/plans-db";
import { getBillingTerms,getSetting } from "../src/lib/operator-settings";

export const dynamic = "force-dynamic";

function gb(bytes:number){return Math.round(Number(bytes)/1024**3);}
function termPrice(monthlyUsd:number,months:number,discountPercent:number){return Math.round(monthlyUsd*months*(1-discountPercent/100)*100)/100;}

export default async function Home(){
  const [plans,terms,portal]=await Promise.all([
    getPublicPlans(),
    getBillingTerms(),
    getSetting<any>("portal_content",{
      heroTitle:"Store your media. Use it anywhere.",
      heroSubtitle:"Upload images, videos and files, organize them in one place, and use fast media links across your websites, apps and campaigns.",
      enterpriseTitle:"Need a custom plan?",
      enterpriseText:"Get a plan tailored to your storage, delivery, team, branding and business requirements.",
      maintenanceNotice:"",
      signupEnabled:true,
      planBenefits:["Images, video and files","Cached Mkety delivery links","Usage and limit dashboard","Secure direct uploads","Preview, copy links and delete","Payment and renewal controls"],
    }),
  ]);

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/trust">Security & reliability</Link><Link href="/login">Login</Link>{portal.signupEnabled!==false&&<Link className="btn" href="/signup">Register</Link>}</div></nav>
    {portal.maintenanceNotice&&<div className="notice">{String(portal.maintenanceNotice)}</div>}
    <section className="hero"><h1>{String(portal.heroTitle)}</h1><p>{String(portal.heroSubtitle)}</p></section>
    <section className="grid" style={{marginBottom:24}}>
      <article className="card"><h2>Fast media delivery</h2><p>Upload images, videos and files once and use reliable media links across your websites, apps and campaigns.</p><Link href="/trust">Security & reliability</Link></article>
      <article className="card"><h2>Simple, predictable plans</h2><p>Know exactly what is included and add more capacity whenever your business needs it.</p></article>
      <article className="card"><h2>Your brand, your media address</h2><p>Eligible custom plans can serve files from a branded address such as <strong>media.example.com</strong>.</p><Link href="/enterprise">Explore custom plans</Link></article>
    </section>
    <section><h2>Plans</h2><p className="muted">Monthly, 3-month, 6-month and yearly billing. Longer terms receive a small discount.</p>
      <div className="grid plans">{plans.map((plan:any)=><article className="card" key={plan.code}>
        <h3>{plan.name}</h3><div className="price">{"$"}{Number(plan.monthly_usd).toFixed(0)}<span className="muted" style={{fontSize:14}}>/mo</span></div>
        <ul className="features">
          <li>{gb(plan.storage_bytes)} GB storage</li><li>{gb(plan.delivery_bytes)} GB delivery</li>
          <li>{Number(plan.delivery_requests).toLocaleString()} delivery requests</li><li>{plan.logical_buckets} buckets</li>
          <li>{plan.team_seats} team seat{Number(plan.team_seats)===1?"":"s"}</li>
          {(portal.planBenefits||[]).map((benefit:string)=><li key={benefit}>{benefit}</li>)}
          {plan.dedicated_storage_eligible&&<li>Custom hosting options</li>}
        </ul>
        {portal.signupEnabled!==false&&<Link className="btn" href={"/signup?plan="+plan.code}>Choose {plan.name}</Link>}
        <div style={{marginTop:14}} className="muted">{(terms as any[]).filter((term)=>Number(term.months)>1).map((term)=><div key={term.months}>{term.label}: {"$"}{termPrice(Number(plan.monthly_usd),Number(term.months),Number(term.discountPercent||0)).toFixed(2)} ({Number(term.discountPercent||0)}% off)</div>)}</div>
      </article>)}</div>
    </section>
    <section className="card"><h2>{String(portal.enterpriseTitle)}</h2><p>{String(portal.enterpriseText)}</p><Link className="btn" href="/enterprise">Request a custom plan</Link></section>
  </main>;
}
