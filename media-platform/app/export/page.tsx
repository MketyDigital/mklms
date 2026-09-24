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
      <h1>Export Library</h1>
      <p>Export your complete Mkety Media library without contacting support.</p>
      <p><strong>{Number(counts?.objects||0).toLocaleString()}</strong> files · <strong>{(Number(counts?.bytes||0)/1024**3).toFixed(2)} GB</strong></p>
      <p className="muted">Exports preserve bucket names, object names, sizes, content types and permanent download URLs. Your files remain in Mkety until you delete them.</p>
      {domain?.hostname&&<p className="muted">Active branded domain: https://{String(domain.hostname)}</p>}
      <div className="toolbar" style={{marginTop:18}}>
        <a className="btn" href="/api/export?format=json">Download JSON manifest</a>
        <a className="btn secondary" href="/api/export?format=csv">Download CSV manifest</a>
        <a className="btn secondary" href="/api/export?format=sh">Download macOS/Linux download script</a>
        <a className="btn secondary" href="/api/export?format=ps1">Download Windows PowerShell script</a>
      </div>
      <div className="notice" style={{marginTop:18}}>
        <strong>Leaving Mkety?</strong>
        <p>Use the manifest or download script to copy the entire library to your own computer or another storage provider. Enterprise customers can also request a managed migration.</p>
      </div>
    </section>
  </main>;
}
