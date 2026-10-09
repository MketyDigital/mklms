import type { Metadata } from "next";
import { redirect,notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../src/lib/current-user";
import { getMediaDb } from "../../../src/lib/postgres";
import UploadClient from "./UploadClient";
import FileLibrary from "./FileLibrary";

export const dynamic = "force-dynamic";
export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

function shortIdForUuid(id:string){
  const hex=id.replace(/-/g,"");
  if(!/^[0-9a-f]{32}$/i.test(hex)) return id;
  const bytes=hex.match(/../g)!.map(byte=>parseInt(byte,16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

function assetUrl(tenantSlug:string,bucketSlug:string,key:string){
  return "https://assets.mkety.app/"+encodeURIComponent(tenantSlug)+"/"+encodeURIComponent(bucketSlug)+"/"+key.split("/").map(encodeURIComponent).join("/");
}

export default async function BucketPage({params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(); if(!user) redirect("/login");
  if(user.role==="billing") redirect("/dashboard");
  const {id}=await params;
  const db=getMediaDb();
  const bucket=await db.prepare("SELECT id,slug FROM media_buckets WHERE id=? AND tenant_id=? LIMIT 1").bind(id,user.tenantId).first<any>();
  if(!bucket) notFound();
  const objects=await db.prepare("SELECT id,object_key,content_type,size_bytes,created_at FROM media_objects WHERE bucket_id=? AND status='ready' ORDER BY created_at DESC LIMIT 500").bind(id).all<any>();
  const files=(objects.results||[]).map((o:any)=>{
    const canonical=assetUrl(user.tenantSlug,String(bucket.slug),String(o.object_key));
    return {
      id:String(o.id),
      key:String(o.object_key),
      contentType:String(o.content_type||"application/octet-stream").toLowerCase(),
      size:Number(o.size_bytes||0),
      createdAt:String(o.created_at||""),
      shortUrl:"https://media.mkety.com/f/"+shortIdForUuid(String(o.id)),
      assetUrl:canonical,
    };
  });

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/buckets">Buckets</Link><Link href="/dashboard">Dashboard</Link></div></nav>
    <h1>{String(bucket.slug)}</h1>
    <UploadClient bucketId={id}/>
    <FileLibrary files={files}/>
    {!files.length && ["owner","admin"].includes(user.role) && <div className="card" style={{marginTop:18}}>
      <h3>Delete bucket</h3>
      <p className="muted">Only empty buckets can be deleted.</p>
      <form method="post" action="/api/buckets/delete"><input type="hidden" name="bucketId" value={id}/><button className="btn secondary">Delete empty bucket</button></form>
    </div>}
  </main>;
}
