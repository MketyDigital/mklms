import { getPublicPlans } from "../../src/lib/plans-db";
import { getBillingTerms,getSetting } from "../../src/lib/operator-settings";
import Link from "next/link";

export default async function SignupPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const params=await searchParams;
  const [plans,terms,portal]=await Promise.all([getPublicPlans(),getBillingTerms(),getSetting<any>("portal_content",{signupEnabled:true})]);
  if(portal.signupEnabled===false) return <main className="wrap"><div className="card form"><h1>Signups are currently paused</h1><p className="muted">Mkety Media is not accepting new self-service accounts right now.</p><Link className="btn" href="/">Back home</Link></div></main>;
  return <main className="wrap"><form className="card form" method="post" action="/api/auth/signup">
    <h1>Create your account</h1>
    <label>Business / project name</label><input name="name" required maxLength={100}/>
    <label>Username</label><input name="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]+"/>
    <label>Password</label><input type="password" name="password" required minLength={10}/>
    <label>Plan</label><select name="plan" defaultValue={params.plan||"starter"}>{plans.map((plan:any)=><option key={plan.code} value={plan.code}>{plan.name} — {"$"}{Number(plan.monthly_usd).toFixed(0)}/mo</option>)}</select>
    <label>Billing term</label><select name="term" defaultValue="1">{(terms as any[]).map((term)=><option key={term.months} value={term.months}>{term.label}{Number(term.discountPercent||0)>0?" — "+Number(term.discountPercent)+"% off":""}</option>)}</select>
    <button className="btn" type="submit">Continue to payment</button><p className="muted">Your storage activates automatically after payment approval.</p>
  </form></main>;
}
