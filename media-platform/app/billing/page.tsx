import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../src/lib/current-user";
import { getTenantState } from "../../src/lib/tenant-state";
import { getMediaDb, getMediaEnv } from "../../src/lib/postgres";
import { getSetting,getBillingTerms } from "../../src/lib/operator-settings";

export const dynamic = "force-dynamic";

export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

function gb(bytes:any){return Number(bytes||0)/1024**3;}

export default async function BillingPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  const params=await searchParams;

  const state=await getTenantState(user.tenantId);
  const db=getMediaDb();
  const [invoice,plansResult,addonsResult,activeAddonsResult,bank,billingTerms]=await Promise.all([
    db.prepare("SELECT id,reference,amount_usd,amount_local,local_currency,status,payment_method,checkout_provider,provider_invoice_id,due_at FROM media_invoices WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1").bind(user.tenantId).first<any>(),
    db.prepare("SELECT code,name,monthly_usd,storage_bytes,delivery_bytes,delivery_requests,logical_buckets,team_seats FROM media_plans WHERE active=1 AND code<>'enterprise' ORDER BY monthly_usd").all<any>(),
    db.prepare("SELECT code,name,price_usd,storage_bytes,delivery_bytes,delivery_requests FROM media_addon_products WHERE active=1 ORDER BY display_order,price_usd").all<any>(),
    db.prepare("SELECT a.product_code,p.name,a.storage_bytes,a.delivery_bytes,a.delivery_requests,a.ends_at FROM media_tenant_addons a JOIN media_addon_products p ON p.code=a.product_code WHERE a.tenant_id=? AND a.starts_at<=datetime('now') AND a.ends_at>datetime('now') ORDER BY a.created_at DESC").bind(user.tenantId).all<any>(),
    getSetting<any>("bank_transfer",{enabled:false,currency:"NGN",usdToLocalRate:0,roundTo:100,bankName:"",accountName:"",accountNumber:"",paymentUrl:"",paymentProviderName:"",paymentButtonText:"Pay securely",instructions:""}),
    getBillingTerms(),
  ]);

  const hasPending=Boolean(invoice&&invoice.status==="pending");
  const paymentStarted=Boolean(invoice&&(invoice.checkout_provider||String(invoice.payment_method||"invoice")!=="invoice"));
  const runtime=getMediaEnv() as any;
  const nowPaymentsConfigured=Boolean(runtime.NOWPAYMENTS_API_KEY&&runtime.NOWPAYMENTS_IPN_SECRET);
  const flutterwaveConfigured=Boolean((runtime.FLUTTERWAVE_CHECKOUT_BROKER_URL&&runtime.FLUTTERWAVE_CHECKOUT_BROKER_SECRET)||(runtime.FLUTTERWAVE_V3_SECRET_KEY&&runtime.FLUTTERWAVE_V3_SECRET_HASH));
  const koraConfigured=Boolean(runtime.KORA_SECRET_KEY);
  const telegramBotUsername=String(runtime.MEDIA_TELEGRAM_BOT_USERNAME||"");
  const currentPlan=await db.prepare("SELECT plan_code FROM media_tenants WHERE id=? LIMIT 1").bind(user.tenantId).first<any>();
  const currentPublicPlan=(plansResult.results||[]).find((p:any)=>p.code===currentPlan?.plan_code);
  const bankHasDetails=Boolean(bank.bankName||bank.accountName||bank.accountNumber);
  const paymentUrl=String(bank.paymentUrl||"");
  const manualLabel=paymentUrl?(bankHasDetails?"Bank transfer / payment link":"Pay with payment link"):"Pay by bank transfer";

  return (
    <main className="wrap">
      <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/dashboard">Dashboard</Link><form style={{display:"inline"}} method="post" action="/api/auth/logout"><button className="btn secondary">Logout</button></form></div></nav>

      <div className="card">
        <h1>Billing & capacity</h1>
        <p><strong>{state.planName}</strong> · {"$"}{state.monthlyUsd.toFixed(2)}/month equivalent · {state.billingTermMonths}-month term</p>
        <p>Status: <strong>{state.subscriptionStatus}</strong></p>
        {state.renewalAt&&<p>Current paid period ends: {new Date(state.renewalAt).toLocaleDateString()}</p>}
        {(state.addonStorageBytes>0||state.addonDeliveryBytes>0||state.addonDeliveryRequests>0)&&<p className="muted">Current limits include paid extra capacity.</p>}
      </div>

      {params.payment==="processing"&&<div className="notice" style={{marginTop:18}}>Payment confirmation is being checked. This page will show the updated account status after the provider confirms the transaction.</div>}

      {hasPending&&(
        <div className="card" style={{marginTop:18}}>
          <h2>Payment due</h2>
          <p>Invoice <strong>{String(invoice.reference)}</strong></p>
          <div className="price">{"$"}{Number(invoice.amount_usd).toFixed(2)}</div>

          {params.bank==="1"&&invoice.checkout_provider==="bank_transfer"?(
            <div className="notice" style={{marginTop:18}}>
              <h3>Manual payment</h3>
              {invoice.amount_local!=null&&<p><strong>{String(invoice.local_currency||"")} {Number(invoice.amount_local).toLocaleString()}</strong></p>}
              {bankHasDetails&&<>
                <p>{String(bank.bankName||"")}</p>
                <p>{String(bank.accountName||"")}</p>
                <p><strong>{String(bank.accountNumber||"")}</strong></p>
              </>}
              {paymentUrl&&<p style={{marginTop:16}}><a className="btn" href={paymentUrl} target="_blank" rel="noopener noreferrer">{String(bank.paymentButtonText||"Pay securely")}</a>{bank.paymentProviderName&&<span className="muted"> via {String(bank.paymentProviderName)}</span>}</p>}
              {bank.instructions&&<p>{String(bank.instructions)}</p>}
              <p>Use <strong>{String(invoice.reference)}</strong> as your reference where possible. Your purchase activates only after Mkety verifies the payment.</p>
              {telegramBotUsername&&<p style={{marginTop:16}}><a className="btn secondary" href={"https://t.me/"+telegramBotUsername+"?start=pay_"+encodeURIComponent(String(invoice.reference))} target="_blank" rel="noopener noreferrer">Send proof on Telegram</a></p>}
              {!telegramBotUsername&&<p className="muted">Telegram proof submission is not configured yet. You can still contact Mkety support while the payment is verified manually.</p>}
            </div>
          ):(
            <>
              <div className="toolbar" style={{marginTop:18,alignItems:"flex-start"}}>
                {flutterwaveConfigured&&<form method="post" action="/api/billing/flutterwave">
                  <input type="hidden" name="invoiceId" value={String(invoice.id)}/>
                  {user.email?<input type="hidden" name="email" value={user.email}/>:<input type="email" name="email" required placeholder="Email for payment receipt"/>}
                  <button className="btn">Pay with card / local methods</button>
                  <p className="muted">Powered by Flutterwave</p>
                </form>}
                {koraConfigured&&<form method="post" action="/api/billing/kora">
                  <input type="hidden" name="invoiceId" value={String(invoice.id)}/>
                  {user.email?<input type="hidden" name="email" value={user.email}/>:<input type="email" name="email" required placeholder="Email for payment receipt"/>}
                  <button className="btn">Pay with Kora</button>
                  <p className="muted">Available where enabled for this merchant account</p>
                </form>}
                {nowPaymentsConfigured&&<form method="post" action="/api/billing/nowpayments"><input type="hidden" name="invoiceId" value={String(invoice.id)}/><button className="btn secondary">Pay with crypto</button><p className="muted">Powered by NOWPayments</p></form>}
                {bank.enabled&&<form method="post" action="/api/billing/bank-transfer"><input type="hidden" name="invoiceId" value={String(invoice.id)}/><button className="btn secondary">{manualLabel}</button></form>}
              </div>
              {!flutterwaveConfigured&&!koraConfigured&&!nowPaymentsConfigured&&!bank.enabled&&<p className="muted">No payment method is configured yet. Contact Mkety support.</p>}
            </>
          )}
          <p className="muted">No quota or plan increase is applied before payment verification.</p>
          {state.status==="pending"&&!paymentStarted&&<details style={{marginTop:18}}>
            <summary><strong>Choose a different plan or billing term</strong></summary>
            <form method="post" action="/api/billing/change-plan" className="form" style={{marginTop:12}}>
              <label>Plan<select name="plan" defaultValue={currentPlan?.plan_code||"starter"}>{(plansResult.results||[]).map((p:any)=><option key={p.code} value={p.code}>{p.name} — {"$"}{Number(p.monthly_usd).toFixed(2)}/mo</option>)}</select></label>
              <label>Billing term<select name="term" defaultValue={String(state.billingTermMonths)}>{(billingTerms as any[]).map((t:any)=><option key={t.months} value={t.months}>{t.label}{Number(t.discountPercent||0)>0?" — "+Number(t.discountPercent)+"% off":""}</option>)}</select></label>
              <button className="btn secondary">Replace unpaid invoice</button>
              <p className="muted">Your current unpaid invoice is cancelled and replaced. Your account and username stay the same.</p>
            </form>
            <form method="post" action="/api/billing/cancel" style={{marginTop:10}}>
              <button className="btn secondary">Cancel this unpaid invoice</button>
              <p className="muted">You can log out and return later. Your account remains pending and no storage activates until a new invoice is paid.</p>
            </form>
          </details>}
          {state.status==="pending"&&paymentStarted&&<p className="muted">A payment method has already been started for this invoice. To avoid paying an old or cancelled reference, finish this payment or contact Mkety Support before changing the plan.</p>}
        </div>
      )}

      {state.status==="pending"&&!hasPending&&(
        <div className="card" style={{marginTop:18}}>
          <h2>Choose your plan and continue</h2>
          <p className="muted">Your account is saved, but no active payment is pending. Choose any current public plan and billing term to create a fresh invoice.</p>
          <form method="post" action="/api/billing/change-plan" className="form">
            <label>Plan<select name="plan" defaultValue={currentPlan?.plan_code||"starter"}>{(plansResult.results||[]).map((p:any)=><option key={p.code} value={p.code}>{p.name} — {"$"}{Number(p.monthly_usd).toFixed(2)}/mo</option>)}</select></label>
            <label>Billing term<select name="term" defaultValue={String(state.billingTermMonths)}>{(billingTerms as any[]).map((t:any)=><option key={t.months} value={t.months}>{t.label}{Number(t.discountPercent||0)>0?" — "+Number(t.discountPercent)+"% off":""}</option>)}</select></label>
            <button className="btn">Create payment</button>
          </form>
        </div>
      )}

      {invoice&&["rejected","expired","cancelled"].includes(String(invoice.status))&&state.status!=="pending"&&(
        <div className="notice danger" style={{marginTop:18}}>
          <p>That payment request is no longer payable.</p>
          <form method="post" action="/api/billing/retry"><button className="btn">Create a new payment</button></form>
        </div>
      )}

      {state.status==="active"&&!hasPending&&(
        <>
          <section className="card" style={{marginTop:18}}>
            <h2>Extra capacity</h2>
            <p className="muted">Prepaid extra capacity lasts until your current paid period ends. It never creates a negative balance.</p>
            <div className="grid plans">
              {(addonsResult.results||[]).map((a:any)=><article className="card" key={a.code}>
                <h3>{a.name}</h3>
                <div className="price">{"$"}{Number(a.price_usd).toFixed(2)}</div>
                <ul className="features">
                  {Number(a.storage_bytes)>0&&<li>+{gb(a.storage_bytes).toFixed(0)} GB storage</li>}
                  {Number(a.delivery_bytes)>0&&<li>+{gb(a.delivery_bytes).toFixed(0)} GB delivery</li>}
                  {Number(a.delivery_requests)>0&&<li>+{Number(a.delivery_requests).toLocaleString()} requests</li>}
                  {state.renewalAt&&<li>Valid until {new Date(state.renewalAt).toLocaleDateString()}</li>}
                </ul>
                <form method="post" action="/api/billing/addon"><input type="hidden" name="addon" value={a.code}/><button className="btn">Buy extra capacity</button></form>
              </article>)}
            </div>
          </section>

          {!state.enterpriseFeatures&&currentPublicPlan&&(
            <section className="card" style={{marginTop:18}}>
              <h2>Upgrade plan</h2>
              <p className="muted">Upgrades take effect immediately after payment. You pay only the prorated difference for the remaining current period.</p>
              <div className="grid plans">
                {(plansResult.results||[]).filter((p:any)=>Number(p.monthly_usd)>Number(currentPublicPlan.monthly_usd)).map((p:any)=><article className="card" key={p.code}>
                  <h3>{p.name}</h3>
                  <div className="price">{"$"}{Number(p.monthly_usd).toFixed(2)}<span className="muted" style={{fontSize:14}}>/mo</span></div>
                  <ul className="features">
                    <li>{gb(p.storage_bytes).toFixed(0)} GB storage</li>
                    <li>{gb(p.delivery_bytes).toFixed(0)} GB delivery</li>
                    <li>{Number(p.delivery_requests).toLocaleString()} requests</li>
                    <li>{p.logical_buckets} buckets</li>
                    <li>{p.team_seats} team seats</li>
                  </ul>
                  <form method="post" action="/api/billing/upgrade"><input type="hidden" name="plan" value={p.code}/><button className="btn">Upgrade to {p.name}</button></form>
                </article>)}
              </div>
            </section>
          )}

          {(activeAddonsResult.results||[]).length>0&&(
            <section className="card" style={{marginTop:18}}>
              <h2>Active extra capacity</h2>
              <table className="table"><thead><tr><th>Pack</th><th>Capacity</th><th>Ends</th></tr></thead><tbody>
                {(activeAddonsResult.results||[]).map((a:any,index:number)=><tr key={a.product_code+"-"+index}><td>{a.name}</td><td>
                  {Number(a.storage_bytes)>0&&<span>+{gb(a.storage_bytes).toFixed(0)} GB storage </span>}
                  {Number(a.delivery_bytes)>0&&<span>+{gb(a.delivery_bytes).toFixed(0)} GB delivery </span>}
                  {Number(a.delivery_requests)>0&&<span>+{Number(a.delivery_requests).toLocaleString()} requests</span>}
                </td><td>{new Date(a.ends_at).toLocaleDateString()}</td></tr>)}
              </tbody></table>
            </section>
          )}
        </>
      )}
    </main>
  );
}
