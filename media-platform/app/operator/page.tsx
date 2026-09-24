import { redirect } from "next/navigation";
import { isOperator } from "../../src/auth/operator";
import { getMediaDb } from "../../src/lib/postgres";
import { getBillingTerms,getSetting } from "../../src/lib/operator-settings";
import { configuredProviders } from "../../src/config/providers";
import { getProviderEnv } from "../../src/lib/provider-env";

function gb(bytes:any){return bytes==null?"":(Number(bytes)/1024**3).toFixed(0);}

export default async function OperatorPage(){
  if(!(await isOperator())) redirect("/operator/login");
  const db=getMediaDb();
  const [plansResult,tenantsResult,poolsResult,pendingInvoices,terms,bank,enforcement,portal]=await Promise.all([
    db.prepare("SELECT * FROM media_plans ORDER BY display_order").all<any>(),
    db.prepare("SELECT t.id,t.slug,t.name,t.status,t.plan_code,c.* FROM media_tenants t LEFT JOIN media_tenant_commercial_terms c ON c.tenant_id=t.id ORDER BY t.created_at DESC LIMIT 200").all<any>(),
    db.prepare("SELECT * FROM media_provider_pools ORDER BY priority").all<any>(),
    db.prepare("SELECT i.id,i.reference,i.amount_usd,i.amount_local,i.local_currency,i.payment_method,i.created_at,t.name AS tenant_name FROM media_invoices i JOIN media_tenants t ON t.id=i.tenant_id WHERE i.status='pending' ORDER BY i.created_at DESC LIMIT 100").all<any>(),
    getBillingTerms(),
    getSetting<any>("bank_transfer",{enabled:false,currency:"NGN",usdToLocalRate:0,roundTo:100,bankName:"",accountName:"",accountNumber:"",instructions:""}),
    getSetting<any>("enforcement",{graceDays:3,suspendDeliveryAfterGrace:true}),
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
  const configured=new Map(configuredProviders(getProviderEnv()).map((p)=>[p.id,p.status]));

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media Operator</div><form method="post" action="/api/operator/logout"><button className="btn secondary">Logout</button></form></nav>

    <section className="card"><h2>Portal content</h2>
      <form method="post" action="/api/operator/settings"><input type="hidden" name="kind" value="portal"/>
      <label>Hero title<input name="heroTitle" defaultValue={portal.heroTitle||""}/></label>
      <label>Hero subtitle<input name="heroSubtitle" defaultValue={portal.heroSubtitle||""}/></label>
      <label>Enterprise title<input name="enterpriseTitle" defaultValue={portal.enterpriseTitle||""}/></label>
      <label>Enterprise text<input name="enterpriseText" defaultValue={portal.enterpriseText||""}/></label>
      <label>Maintenance notice<input name="maintenanceNotice" defaultValue={portal.maintenanceNotice||""}/></label>
      <label><input type="checkbox" name="signupEnabled" defaultChecked={portal.signupEnabled!==false}/> Public signup enabled</label>
      <label>Benefits shown on every plan<textarea name="planBenefits" rows={8} defaultValue={(portal.planBenefits||[]).join("\n")} style={{width:"100%",padding:12}}/></label>
      <button className="btn">Save portal content</button></form>
    </section>

    <section className="card" style={{marginTop:18}}><h2>Billing terms</h2>
      <form method="post" action="/api/operator/settings"><input type="hidden" name="kind" value="billing_terms"/><div className="grid stats">
      {[3,6,12].map((m)=>{const t=(terms as any[]).find((x)=>Number(x.months)===m);return <label key={m}>{m} months discount %<input name={"discount"+m} type="number" step="0.1" min="0" max="20" defaultValue={Number(t?.discountPercent||0)}/></label>})}
      </div><button className="btn">Save discounts</button></form>
    </section>

    <section className="card" style={{marginTop:18}}><h2>Local bank transfer</h2>
      <form method="post" action="/api/operator/settings"><input type="hidden" name="kind" value="bank"/>
      <label><input type="checkbox" name="enabled" defaultChecked={Boolean(bank.enabled)}/> Enable bank transfer</label>
      <label>Local currency<input name="currency" defaultValue={bank.currency||"NGN"}/></label>
      <label>USD to local rate<input name="usdToLocalRate" type="number" step="0.01" defaultValue={Number(bank.usdToLocalRate||0)}/></label>
      <label>Round local amount to<input name="roundTo" type="number" step="1" defaultValue={Number(bank.roundTo||100)}/></label>
      <label>Bank name<input name="bankName" defaultValue={bank.bankName||""}/></label>
      <label>Account name<input name="accountName" defaultValue={bank.accountName||""}/></label>
      <label>Account number<input name="accountNumber" defaultValue={bank.accountNumber||""}/></label>
      <label>Instructions<input name="instructions" defaultValue={bank.instructions||""}/></label>
      <button className="btn">Save bank details</button></form>
    </section>

    <section className="card" style={{marginTop:18}}><h2>Enforcement</h2>
      <form method="post" action="/api/operator/settings"><input type="hidden" name="kind" value="enforcement"/>
      <label>Read-only grace days<input type="number" name="graceDays" min="0" max="30" defaultValue={Number(enforcement.graceDays||3)}/></label>
      <label><input type="checkbox" name="suspendDelivery" defaultChecked={Boolean(enforcement.suspendDeliveryAfterGrace)}/> Suspend public delivery after grace</label>
      <button className="btn">Save enforcement</button></form>
    </section>

    <h2 style={{marginTop:30}}>Pending payments</h2>
    <div className="card"><table className="table"><thead><tr><th>Customer</th><th>Invoice</th><th>Amount</th><th>Method</th><th></th></tr></thead><tbody>
      {(pendingInvoices.results||[]).map((i:any)=><tr key={i.id}><td>{i.tenant_name}</td><td>{i.reference}</td><td>{i.amount_local!=null?String(i.local_currency||"")+" "+Number(i.amount_local).toLocaleString():"$"+Number(i.amount_usd).toFixed(2)}</td><td>{i.payment_method}</td><td><div className="toolbar"><form method="post" action="/api/operator/invoices"><input type="hidden" name="invoiceId" value={i.id}/><input type="hidden" name="action" value="approve"/><button className="btn">Approve</button></form><form method="post" action="/api/operator/invoices"><input type="hidden" name="invoiceId" value={i.id}/><input type="hidden" name="action" value="reject"/><button className="btn secondary">Reject</button></form></div></td></tr>)}
    </tbody></table></div>

    <h2 style={{marginTop:30}}>Public plans</h2>
    <div className="grid">{(plansResult.results||[]).map((p:any)=><form className="card" method="post" action="/api/operator/plans" key={p.code}>
      <input type="hidden" name="code" value={p.code}/><h3>{p.code}</h3>
      <label>Name<input name="name" defaultValue={p.name}/></label>
      <label>Monthly USD<input name="monthly" type="number" step="0.01" defaultValue={p.monthly_usd}/></label>
      <label>Storage GB<input name="storageGb" type="number" defaultValue={gb(p.storage_bytes)}/></label>
      <label>Delivery GB<input name="deliveryGb" type="number" defaultValue={gb(p.delivery_bytes)}/></label>
      <label>Requests<input name="requests" type="number" defaultValue={p.delivery_requests}/></label>
      <label>Buckets<input name="buckets" type="number" defaultValue={p.logical_buckets}/></label>
      <label>Seats<input name="seats" type="number" defaultValue={p.team_seats}/></label>
      <label>Max object GB<input name="maxObjectGb" type="number" defaultValue={gb(p.max_object_bytes)}/></label>
      <p className="muted">Overage: hard cap (launch safety)</p>
      <label><input type="checkbox" name="dedicated" defaultChecked={Boolean(p.dedicated_storage_eligible)}/> Dedicated eligible</label>
      <label><input type="checkbox" name="active" defaultChecked={Boolean(p.active)}/> Public</label>
      <button className="btn">Save plan</button>
    </form>)}</div>

    <h2 style={{marginTop:30}}>Storage pools</h2>
    <div className="grid">{(poolsResult.results||[]).map((p:any)=><form className="card" method="post" action="/api/operator/providers" key={p.pool_key}>
      <input type="hidden" name="poolKey" value={p.pool_key}/><h3>{p.label}</h3>
      <p className="muted">Configuration: {configured.get(String(p.pool_key))||"unknown"}</p>
      <label><input type="checkbox" name="available" defaultChecked={Boolean(p.available_to_customers)}/> Available for placement</label>
      <label>Priority<input type="number" name="priority" defaultValue={p.priority}/></label>
      <button className="btn">Save pool</button>
    </form>)}</div>

    <h2 style={{marginTop:30}}>Customers</h2>
    <div className="grid">{(tenantsResult.results||[]).map((t:any)=><form className="card" method="post" action="/api/operator/tenants" key={t.id}>
      <input type="hidden" name="tenantId" value={t.id}/><h3>{t.name}</h3><p className="muted">base {t.plan_code}</p><label>Public slug<input name="slug" defaultValue={t.slug}/></label>
      <label>Account status<select name="status" defaultValue={t.status}><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></label>
      <label>Private display name<input name="displayName" defaultValue={t.display_name||""} placeholder="e.g. Starpips Launch"/></label>
      <label>Custom monthly USD<input name="monthlyUsd" type="number" step="0.01" defaultValue={t.monthly_usd??""} placeholder="blank = base plan"/></label>
      <label>Storage GB<input name="storageGb" type="number" defaultValue={gb(t.storage_bytes)} placeholder="blank = base"/></label>
      <label>Delivery GB<input name="deliveryGb" type="number" defaultValue={gb(t.delivery_bytes)} placeholder="blank = base"/></label>
      <label>Requests<input name="requests" type="number" defaultValue={t.delivery_requests??""} placeholder="blank = base"/></label>
      <label>Buckets<input name="buckets" type="number" defaultValue={t.logical_buckets??""} placeholder="blank = base"/></label>
      <label>Seats<input name="seats" type="number" defaultValue={t.team_seats??""} placeholder="blank = base"/></label>
      <label>Max object GB<input name="maxObjectGb" type="number" defaultValue={gb(t.max_object_bytes)} placeholder="blank = base"/></label>
      <label>Billing term<select name="term" defaultValue={t.billing_term_months||1}><option value="1">Monthly</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></label>
      <label>Infrastructure<select name="infrastructure" defaultValue={t.infrastructure_mode||"automatic"}><option value="automatic">Automatic</option><option value="regional">Regional</option><option value="dedicated">Dedicated</option></select></label>
      <label>Internal storage pool<select name="preferredPoolKey" defaultValue={t.preferred_pool_key||"r2-global"}>{(poolsResult.results||[]).map((p:any)=><option key={p.pool_key} value={p.pool_key}>{p.label}</option>)}</select></label>
      <p className="muted">Overage: hard cap (launch safety)</p>
      <label><input type="checkbox" name="enterprise" defaultChecked={Boolean(t.enterprise_features)}/> Enterprise capabilities</label>
      <button className="btn">Save customer</button>
    </form>)}</div>
  </main>;
}
