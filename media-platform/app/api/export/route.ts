import { getCurrentUser } from "../../../src/lib/current-user";
import { getMediaDb } from "../../../src/lib/postgres";

function csv(value:unknown){
  const s=String(value??"");
  return '"'+s.replaceAll('"','""')+'"';
}
function safePathPart(value:string){
  return value.replace(/[\\/:*?"<>|\r\n]+/g,"-").replace(/^\.+/,"_")||"file";
}
function shQuote(value:string){return "'"+value.replaceAll("'","'\\''")+"'";}
function psQuote(value:string){return "'"+value.replaceAll("'","''")+"'";}

export async function GET(request:Request){
  const user=await getCurrentUser();
  if(!user) return new Response("Unauthorized",{status:401});
  const url=new URL(request.url);
  const format=(url.searchParams.get("format")||"json").toLowerCase();
  if(!["json","csv","sh","ps1"].includes(format)) return new Response("Unsupported format",{status:400});

  const db=getMediaDb();
  const [objectsResult,domain]=await Promise.all([
    db.prepare("SELECT b.slug AS bucket_slug,o.object_key,o.content_type,o.size_bytes,o.created_at FROM media_objects o JOIN media_buckets b ON b.id=o.bucket_id WHERE b.tenant_id=? AND o.status='ready' ORDER BY b.slug,o.created_at,o.object_key").bind(user.tenantId).all<any>(),
    db.prepare("SELECT hostname FROM media_custom_domains WHERE tenant_id=? AND status='active' ORDER BY created_at LIMIT 1").bind(user.tenantId).first<any>(),
  ]);

  const items=(objectsResult.results||[]).map((o:any)=>{
    const bucket=String(o.bucket_slug);
    const key=String(o.object_key);
    const publicUrl=domain?.hostname
      ?"https://"+String(domain.hostname)+"/"+encodeURIComponent(bucket)+"/"+key.split("/").map(encodeURIComponent).join("/")
      :"https://assets.mkety.app/"+encodeURIComponent(user.tenantSlug)+"/"+encodeURIComponent(bucket)+"/"+key.split("/").map(encodeURIComponent).join("/");
    return {bucket,key,contentType:String(o.content_type||""),sizeBytes:Number(o.size_bytes||0),createdAt:String(o.created_at||""),url:publicUrl};
  });

  const stamp=new Date().toISOString().slice(0,10);
  if(format==="json"){
    return new Response(JSON.stringify({exportedAt:new Date().toISOString(),tenant:user.tenantName,tenantSlug:user.tenantSlug,fileCount:items.length,files:items},null,2),{
      headers:{"content-type":"application/json; charset=utf-8","content-disposition":'attachment; filename="mkety-media-export-'+stamp+'.json"',"cache-control":"no-store"}
    });
  }
  if(format==="csv"){
    const lines=["bucket,object_key,content_type,size_bytes,created_at,url",...items.map((i)=>[i.bucket,i.key,i.contentType,i.sizeBytes,i.createdAt,i.url].map(csv).join(","))];
    return new Response(lines.join("\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="mkety-media-export-'+stamp+'.csv"',"cache-control":"no-store"}});
  }
  if(format==="sh"){
    const lines=["#!/usr/bin/env bash","set -euo pipefail","","# Mkety Media complete-library export",""];
    for(const i of items){
      const folder=safePathPart(i.bucket);
      const file=safePathPart(i.key);
      lines.push("mkdir -p "+shQuote(folder));
      lines.push("curl -L --fail --retry 3 -o "+shQuote(folder+"/"+file)+" "+shQuote(i.url));
    }
    return new Response(lines.join("\n")+"\n",{headers:{"content-type":"text/x-shellscript; charset=utf-8","content-disposition":'attachment; filename="mkety-media-download-all-'+stamp+'.sh"',"cache-control":"no-store"}});
  }
  const lines=["$ErrorActionPreference = 'Stop'","","# Mkety Media complete-library export",""];
  for(const i of items){
    const folder=safePathPart(i.bucket);
    const file=safePathPart(i.key);
    lines.push("New-Item -ItemType Directory -Force -Path "+psQuote(folder)+" | Out-Null");
    lines.push("Invoke-WebRequest -Uri "+psQuote(i.url)+" -OutFile "+psQuote(folder+"/"+file));
  }
  return new Response(lines.join("\r\n")+"\r\n",{headers:{"content-type":"text/plain; charset=utf-8","content-disposition":'attachment; filename="mkety-media-download-all-'+stamp+'.ps1"',"cache-control":"no-store"}});
}
