import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../src/lib/current-user";
import { getTenantState } from "../../src/lib/tenant-state";
import { getMediaDb } from "../../src/lib/postgres";

export const dynamic="force-dynamic";

export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

export default async function DomainsPage(){
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  const state=await getTenantState(user.tenantId);
  const domains=await getMediaDb().prepare("SELECT * FROM media_custom_domains WHERE tenant_id=? AND status<>'removed' ORDER BY created_at DESC").bind(user.tenantId).all<any>();

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/dashboard">Dashboard</Link></div></nav>
    <section className="card">
      <h1>Custom domains</h1>
      <p>Serve your Mkety Media files from your own branded hostname, for example <strong>media.yourcompany.com</strong>.</p>
      {!state.enterpriseFeatures&&<div className="notice">Custom domains are available on eligible custom plans. Contact us to enable this feature for your account.</div>}
      {state.enterpriseFeatures&&<form method="post" action="/api/domains/request" className="form">
        <label>Branded media hostname</label>
        <input name="hostname" required placeholder="media.example.com" pattern="[A-Za-z0-9.-]+"/>
        <button className="btn">Request custom domain</button>
        <p className="muted">Use a subdomain you control. We handle the secure connection and show you the DNS record to add.</p>
      </form>}
    </section>

    {(domains.results||[]).map((d:any)=><section className="card" style={{marginTop:18}} key={d.id}>
      <h2>{d.hostname}</h2><p>Status: <strong>{d.status}</strong>{d.ssl_status?" · TLS "+d.ssl_status:""}</p>
      <p>Create this DNS record:</p>
      <p><strong>CNAME</strong> · Name: <strong>{d.hostname}</strong> · Target: <strong>{d.cname_target}</strong></p>
      {d.ownership_name&&d.ownership_value&&<div className="notice"><p>If domain verification is required, add:</p><p><strong>{d.ownership_type||"TXT"}</strong> {d.ownership_name} → {d.ownership_value}</p></div>}
      {d.status==="active"&&<p>Example URL: <strong>https://{d.hostname}/your-bucket/your-file.jpg</strong></p>}
      {d.last_error&&<p className="muted">Latest provisioning note: {d.last_error}</p>}
    </section>)}
  </main>;
}
