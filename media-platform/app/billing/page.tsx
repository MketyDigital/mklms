import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../src/lib/current-user";
import { getTenantState } from "../../src/lib/tenant-state";
import { getMediaDb } from "../../src/lib/postgres";
import { getSetting } from "../../src/lib/operator-settings";

export default async function BillingPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  const params=await searchParams;

  const state=await getTenantState(user.tenantId);
  const invoice=await getMediaDb().prepare(
    "SELECT id,reference,amount_usd,amount_local,local_currency,status,payment_method,due_at FROM media_invoices WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1"
  ).bind(user.tenantId).first<any>();
  const bank=await getSetting<any>("bank_transfer",{enabled:false,bankName:"",accountName:"",accountNumber:"",instructions:""});

  return (
    <main className="wrap">
      <nav className="nav">
        <div className="brand">Mkety Media</div>
        <div><Link href="/dashboard">Dashboard</Link></div>
      </nav>

      <div className="card">
        <h1>Billing</h1>
        <p><strong>{state.planName}</strong> · {"$"}{state.monthlyUsd.toFixed(2)}/month equivalent · {state.billingTermMonths}-month term</p>
        <p>Status: <strong>{state.subscriptionStatus}</strong></p>
        {state.renewalAt && <p>Renews/ends: {new Date(state.renewalAt).toLocaleDateString()}</p>}
      </div>

      {invoice && invoice.status==="pending" && (
        <div className="card" style={{marginTop:18}}>
          <h2>Payment due</h2>
          <p>Invoice <strong>{String(invoice.reference)}</strong></p>
          <div className="price">{"$"}{Number(invoice.amount_usd).toFixed(2)}</div>

          {params.bank==="1" && invoice.payment_method==="bank_transfer" ? (
            <div className="notice" style={{marginTop:18}}>
              <h3>Bank transfer</h3>
              {invoice.amount_local!=null && <p><strong>{String(invoice.local_currency||"")} {Number(invoice.amount_local).toLocaleString()}</strong></p>}
              <p>{String(bank.bankName||"")}</p>
              <p>{String(bank.accountName||"")}</p>
              <p><strong>{String(bank.accountNumber||"")}</strong></p>
              {bank.instructions && <p>{String(bank.instructions)}</p>}
              <p>Use <strong>{String(invoice.reference)}</strong> as your reference where possible. Your account activates after Mkety verifies the transfer.</p>
            </div>
          ) : (
            <div className="toolbar" style={{marginTop:18}}>
              <form method="post" action="/api/billing/nowpayments">
                <input type="hidden" name="invoiceId" value={String(invoice.id)} />
                <button className="btn">Pay automatically</button>
              </form>
              {bank.enabled && <form method="post" action="/api/billing/bank-transfer">
                <input type="hidden" name="invoiceId" value={String(invoice.id)} />
                <button className="btn secondary">Pay by bank transfer</button>
              </form>}
            </div>
          )}
          <p className="muted">Storage activates only after payment is verified.</p>
        </div>
      )}

      {invoice?.status==="rejected" && <div className="notice danger" style={{marginTop:18}}>That payment request was rejected. Contact Mkety support or start a new payment.</div>}
      {state.status==="active" && <div className="notice success" style={{marginTop:18}}>Your account is active.</div>}
    </main>
  );
}
