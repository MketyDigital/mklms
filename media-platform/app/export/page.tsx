import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../src/lib/current-user";
import { getMediaDb } from "../../src/lib/postgres";

export const dynamic="force-dynamic";

export default async function ExportPage(){
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  const db=getMediaDb();
  const [counts,domain]=await Promise.all([
    db.prepare("SELECT COUNT(*) AS objects,COALESCE(SUM(o.size_bytes),0) AS bytes FROM media_objects o JOIN media_buckets b ON b.id=o.bucket_id WHERE b.tenant_id=? AND o.status='ready'").bind(user.tenantId).first<any>(),
    db.prepare("SELECT hostname FROM media_custom_domains WHERE tenant_id=? AND status='active' ORDER BY created_at LIMIT 1").bind(user.tenantId).first<any>(),
  ]);
  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/dashboard">Dashboard</Link></div></nav>
    <section className="card">
      <h1>Export your library</h1>
      <p>Download a complete record of your media library or use a ready-made script to copy your files.</p>
      <p><strong>{Number(counts?.objects||0).toLocaleString()}</strong> files · <strong>{(Number(counts?.bytes||0)/1024**3).toFixed(2)} GB</strong></p>
      <p className="muted">Exports preserve bucket names, object names, sizes, content types and permanent download URLs. Exporting does not remove or change your files.</p>
      {domain?.hostname&&<p className="muted">Active branded domain: https://{String(domain.hostname)}</p>}
      <div className="toolbar" style={{marginTop:18}}>
        <a className="btn" href="/api/export?format=json">Download JSON manifest</a>
        <a className="btn secondary" href="/api/export?format=csv">Download CSV manifest</a>
        <a className="btn secondary" href="/api/export?format=sh">Download macOS/Linux download script</a>
        <a className="btn secondary" href="/api/export?format=ps1">Download Windows PowerShell script</a>
      </div>
      <div className="notice" style={{marginTop:18}}>
        <strong>Moving your media?</strong>
        <p>Use a manifest or download script to copy your library to your computer or another service. Custom-plan customers can also request migration assistance.</p>
      </div>
    </section>
  </main>;
}
