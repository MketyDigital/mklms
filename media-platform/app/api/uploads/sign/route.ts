import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getTenantState } from "../../../../src/lib/tenant-state";
import { getMediaDb } from "../../../../src/lib/postgres";
import { getProviderEnv } from "../../../../src/lib/provider-env";
import { createProvider } from "../../../../src/providers/factory";

function safeName(name:string){
  return name.replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-180) || "file";
}

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});

  const state=await getTenantState(user.tenantId);
  if(state.status!=="active") return NextResponse.json({error:"Account inactive"},{status:403});

  const body=await request.json().catch(()=>null) as any;
  const bucketId=String(body?.bucketId||"");
  const name=String(body?.name||"");
  const contentType=String(body?.contentType||"application/octet-stream");
  const size=Math.floor(Number(body?.size||0));

  if(!bucketId || !name || !Number.isFinite(size) || size<=0) return NextResponse.json({error:"Invalid upload"},{status:400});
  if(size>state.maxObjectBytes) return NextResponse.json({error:"File exceeds maximum object size"},{status:413});

  const db=getMediaDb();
  const bucket=await db.prepare("SELECT id,slug,prefix,pool_key FROM media_buckets WHERE id=? AND tenant_id=? LIMIT 1").bind(bucketId,user.tenantId).first<any>();
  if(!bucket) return NextResponse.json({error:"Bucket not found"},{status:404});

  const reservations=await db.prepare("SELECT COALESCE(SUM(reserved_bytes),0) AS bytes FROM media_quota_reservations WHERE tenant_id=? AND committed_at IS NULL AND expires_at>datetime('now')").bind(user.tenantId).first<any>();
  const reserved=Number(reservations?.bytes||0);
  if(state.storageUsedBytes+reserved+size>state.storageLimitBytes){
    return NextResponse.json({error:"Storage limit reached"},{status:409});
  }

  const objectId=crypto.randomUUID();
  const objectKey=objectId+"-"+safeName(name);
  const storageKey=String(bucket.prefix)+objectKey;
  const reservationId=crypto.randomUUID();
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();

  await db.batch([
    db.prepare("INSERT INTO media_quota_reservations (id,tenant_id,bucket_id,reservation_key,reserved_bytes,expires_at) VALUES (?,?,?,?,?,?)")
      .bind(reservationId,user.tenantId,bucketId,objectId,size,expiresAt),
    db.prepare("INSERT INTO media_objects (id,bucket_id,object_key,content_type,size_bytes,status) VALUES (?,?,?,?,?,'pending')")
      .bind(objectId,bucketId,objectKey,contentType,size),
  ]);

  try{
    const provider=createProvider(String(bucket.pool_key),getProviderEnv());
    const uploadUrl=await provider.createUploadUrl({key:storageKey,contentType,expiresInSeconds:900});
    const publicUrl="https://assets.mkety.app/"+encodeURIComponent(user.tenantSlug)+"/"+encodeURIComponent(String(bucket.slug))+"/"+objectKey;
    return NextResponse.json({uploadUrl,reservationId,objectId,objectKey,publicUrl});
  }catch(error){
    await db.batch([
      db.prepare("DELETE FROM media_quota_reservations WHERE id=?").bind(reservationId),
      db.prepare("DELETE FROM media_objects WHERE id=?").bind(objectId),
    ]);
    console.error(error);
    return NextResponse.json({error:"Upload provider is not ready"},{status:503});
  }
}
