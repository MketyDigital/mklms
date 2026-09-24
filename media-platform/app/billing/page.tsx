import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../src/lib/current-user";
import { getTenantState } from "../../src/lib/tenant-state";
import { getMediaDb } from "../../src/lib/postgres";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const state = await getTenantState(user.tenantId);
  const db = getMediaDb();
  const invoiceResult = await db.query(
    "SELECT id,reference,amount_usd,status,payment_method,due_at FROM media_invoices WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1",
    [user.tenantId],
  );
  const invoice = invoiceResult.rows[0];

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

      {invoice && invoice.status === "pending" && (
        <div className="card" style={{marginTop:18}}>
          <h2>Payment due</h2>
          <p>Invoice <strong>{invoice.reference}</strong></p>
          <div className="price">{"$"}{Number(invoice.amount_usd).toFixed(2)}</div>
          <div className="toolbar" style={{marginTop:18}}>
            <form method="post" action="/api/billing/nowpayments">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <button className="btn">Pay automatically</button>
            </form>
            <form method="post" action="/api/billing/bank-transfer">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <button className="btn secondary">Pay by bank transfer</button>
            </form>
          </div>
          <p className="muted">Storage activates only after payment is verified.</p>
        </div>
      )}

      {state.status === "active" && (
        <div className="notice success" style={{marginTop:18}}>Your account is active.</div>
      )}
    </main>
  );
}
