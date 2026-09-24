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
      heroTitle:"Upload once. Get fast links. Keep your media simple.",
      heroSubtitle:"Managed image, video and file storage with cached delivery, straightforward limits and one clean dashboard.",
      enterpriseTitle:"Need custom limits?",
      enterpriseText:"Enterprise accounts can use any exact limits, billing terms, regional placement or dedicated infrastructure while keeping the same simple Mkety Media dashboard.",
      maintenanceNotice:"",
      signupEnabled:true,
      planBenefits:["Images, video and files","Cached Mkety delivery links","Usage and limit dashboard","Secure direct uploads","Preview, copy links and delete","Payment and renewal controls"],
    }),
  ]);

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/login">Login</Link>{portal.signupEnabled!==false&&<Link className="btn" href="/signup">Get started</Link>}</div></nav>
    {portal.maintenanceNotice&&<div className="notice">{String(portal.maintenanceNotice)}</div>}
    <section className="hero"><h1>{String(portal.heroTitle)}</h1><p>{String(portal.heroSubtitle)}</p></section>
    <section><h2>Plans</h2><p className="muted">Monthly, 3-month, 6-month and yearly billing. Longer terms receive a small discount.</p>
      <div className="grid plans">{plans.map((plan:any)=><article className="card" key={plan.code}>
        <h3>{plan.name}</h3><div className="price">{"$"}{Number(plan.monthly_usd).toFixed(0)}<span className="muted" style={{fontSize:14}}>/mo</span></div>
        <ul className="features">
          <li>{gb(plan.storage_bytes)} GB storage</li><li>{gb(plan.delivery_bytes)} GB delivery</li>
          <li>{Number(plan.delivery_requests).toLocaleString()} delivery requests</li><li>{plan.logical_buckets} buckets</li>
          <li>{plan.team_seats} team seat{Number(plan.team_seats)===1?"":"s"}</li>
          {(portal.planBenefits||[]).map((benefit:string)=><li key={benefit}>{benefit}</li>)}
          {plan.dedicated_storage_eligible&&<li>Regional or dedicated infrastructure eligibility</li>}
        </ul>
        {portal.signupEnabled!==false&&<Link className="btn" href={"/signup?plan="+plan.code}>Choose {plan.name}</Link>}
        <div style={{marginTop:14}} className="muted">{(terms as any[]).filter((term)=>Number(term.months)>1).map((term)=><div key={term.months}>{term.label}: {"$"}{termPrice(Number(plan.monthly_usd),Number(term.months),Number(term.discountPercent||0)).toFixed(2)} ({Number(term.discountPercent||0)}% off)</div>)}</div>
      </article>)}</div>
    </section>
    <section className="card"><h2>{String(portal.enterpriseTitle)}</h2><p>{String(portal.enterpriseText)}</p><Link className="btn" href="/enterprise">Request Enterprise setup</Link></section>
  </main>;
}
