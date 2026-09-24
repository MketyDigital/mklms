import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../src/lib/current-user";
import { getTenantState } from "../../src/lib/tenant-state";
import { usageView } from "../../src/usage/view-model";

export const dynamic = "force-dynamic";

function formatBytes(value:number) {
  if (value >= 1024 ** 3) return (value / 1024 ** 3).toFixed(1) + " GB";
  if (value >= 1024 ** 2) return (value / 1024 ** 2).toFixed(1) + " MB";
  return Math.round(value / 1024) + " KB";
}

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const state = await getTenantState(user.tenantId);
  if (state.status === "pending") redirect("/billing");

  const usage = usageView({
    storageBytes: state.storageUsedBytes,
    storageLimitBytes: state.storageLimitBytes,
    deliveryBytes: state.deliveryUsedBytes,
    deliveryLimitBytes: state.deliveryLimitBytes,
    requests: state.requestsUsed,
    requestLimit: state.requestLimit,
    bucketCount: state.bucketsUsed,
    bucketLimit: state.bucketLimit,
    renewalAt: state.renewalAt,
  });

  const cards = [
    ["Storage", formatBytes(usage.storage.used) + " / " + formatBytes(usage.storage.limit), usage.storage.percent],
    ["Delivery", formatBytes(usage.delivery.used) + " / " + formatBytes(usage.delivery.limit), usage.delivery.percent],
    ["Requests", usage.requests.used.toLocaleString() + " / " + usage.requests.limit.toLocaleString(), usage.requests.percent],
    ["Buckets", String(usage.buckets.used) + " / " + String(usage.buckets.limit), usage.buckets.percent],
  ] as const;

  return (
    <main className="wrap">
      <nav className="nav">
        <div className="brand">Mkety Media</div>
        <div>
          <Link href="/buckets">Buckets</Link>
          <Link href="/billing">Billing</Link>
          {["owner","admin"].includes(user.role) && <Link href="/team">Team</Link>}
          <form style={{display:"inline"}} method="post" action="/api/auth/logout">
            <button className="btn secondary">Logout</button>
          </form>
        </div>
      </nav>

      <h1>{state.name}</h1>
      <p className="muted">
        {state.planName} · {"$"}{state.monthlyUsd.toFixed(2)}/month equivalent · {state.billingTermMonths}-month term
      </p>

      <div className="grid stats">
        {cards.map(([name,text,percent]) => (
          <div className="card" key={name}>
            <strong>{name}</strong>
            <div style={{fontSize:22,marginTop:8}}>{text}</div>
            <div className="progress"><span style={{width:Math.min(100,percent)+"%"}} /></div>
            <small className="muted">{percent}% used</small>
          </div>
        ))}
      </div>

      {Math.max(usage.storage.percent,usage.delivery.percent,usage.requests.percent) >= 85 && (
        <p className="notice danger">You are approaching a plan limit. Upgrade or add prepaid capacity before reaching 100%.</p>
      )}

      <div className="card" style={{marginTop:18}}>
        <h2>Quick actions</h2>
        <div className="toolbar">
          <Link className="btn" href="/buckets">Manage buckets & files</Link>
          <Link className="btn secondary" href="/billing">Plan & billing</Link>
        </div>
      </div>
    </main>
  );
}
