import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../src/lib/current-user";
import { getTenantState } from "../../src/lib/tenant-state";
import { getMediaDb } from "../../src/lib/postgres";

export default async function BucketsPage(){
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  const state=await getTenantState(user.tenantId);
  if(state.status!=="active") redirect("/billing");

  const result=await getMediaDb().prepare(
    "SELECT b.id,b.slug,b.created_at,COALESCE(SUM(CASE WHEN o.status='ready' THEN o.size_bytes ELSE 0 END),0) AS bytes,COALESCE(SUM(CASE WHEN o.status='ready' THEN 1 ELSE 0 END),0) AS objects FROM media_buckets b LEFT JOIN media_objects o ON o.bucket_id=b.id WHERE b.tenant_id=? GROUP BY b.id,b.slug,b.created_at ORDER BY b.created_at DESC"
  ).bind(user.tenantId).all<any>();

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/dashboard">Dashboard</Link><Link href="/billing">Billing</Link></div></nav>
    <div className="toolbar" style={{justifyContent:"space-between"}}><div><h1>Buckets</h1><p className="muted">{state.bucketsUsed} of {state.bucketLimit} used</p></div></div>
    {state.bucketsUsed<state.bucketLimit && <form className="card" method="post" action="/api/buckets" style={{marginBottom:18}}><label><strong>New bucket</strong></label><div className="toolbar" style={{marginTop:10}}><input name="name" placeholder="landing-pages" required style={{padding:12,border:"1px solid #d1d5db",borderRadius:9,flex:1}}/><button className="btn">Create bucket</button></div></form>}
    <div className="grid">
      {(result.results||[]).map((bucket:any)=><Link key={bucket.id} href={"/buckets/"+bucket.id} className="card" style={{textDecoration:"none",color:"inherit"}}><h3>{bucket.slug}</h3><p className="muted">{Number(bucket.objects)} files · {(Number(bucket.bytes)/1024/1024).toFixed(1)} MB</p></Link>)}
      {!result.results?.length && <div className="notice">Create your first bucket to start uploading.</div>}
    </div>
  </main>;
}
