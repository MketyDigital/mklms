import { redirect,notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../src/lib/current-user";
import { getMediaDb } from "../../../src/lib/postgres";
import UploadClient from "./UploadClient";

export default async function BucketPage({params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(); if(!user) redirect("/login");
  const {id}=await params;
  const db=getMediaDb();
  const bucket=await db.prepare("SELECT id,slug FROM media_buckets WHERE id=? AND tenant_id=? LIMIT 1").bind(id,user.tenantId).first<any>();
  if(!bucket) notFound();
  const objects=await db.prepare("SELECT id,object_key,content_type,size_bytes,created_at FROM media_objects WHERE bucket_id=? AND status='ready' ORDER BY created_at DESC LIMIT 500").bind(id).all<any>();

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/buckets">Buckets</Link><Link href="/dashboard">Dashboard</Link></div></nav>
    <h1>{String(bucket.slug)}</h1>
    <UploadClient bucketId={id}/>
    <div className="card">
      <table className="table"><thead><tr><th>File</th><th>Size</th><th>Link</th><th></th></tr></thead><tbody>
      {(objects.results||[]).map((o:any)=>{
        const url="https://assets.mkety.app/"+encodeURIComponent(user.tenantSlug)+"/"+encodeURIComponent(String(bucket.slug))+"/"+String(o.object_key);
        return <tr key={o.id}><td>{String(o.object_key)}</td><td>{(Number(o.size_bytes)/1024/1024).toFixed(2)} MB</td><td><a href={url} target="_blank">View</a></td><td><form method="post" action="/api/objects/delete"><input type="hidden" name="objectId" value={o.id}/><button className="btn secondary">Delete</button></form></td></tr>;
      })}
      </tbody></table>
      {!objects.results?.length && <p className="muted">No files yet.</p>}
    </div>
  </main>;
}
