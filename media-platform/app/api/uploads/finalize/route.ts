import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";
import { allowRequest } from "../../../../src/auth/rate-limit";
import { createProvider } from "../../../../src/providers/factory";
import { getProviderEnv } from "../../../../src/lib/provider-env";

export async function POST(request:Request){
  if(!(await allowRequest(request,"MEDIA_MUTATION_RATE_LIMITER","upload-finalize"))) return NextResponse.json({error:"Too many requests"},{status:429});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(user.role==="billing") return NextResponse.json({error:"Forbidden"},{status:403});

  const body=await request.json().catch(()=>null) as any;
  const reservationId=String(body?.reservationId||"");
  const objectId=String(body?.objectId||"");
  if(!reservationId||!objectId) return NextResponse.json({error:"Invalid request"},{status:400});

  const db=getMediaDb();
  const row=await db.prepare(
    "SELECT r.id,r.reserved_bytes,o.object_key,b.prefix,b.pool_key FROM media_quota_reservations r JOIN media_buckets b ON b.id=r.bucket_id JOIN media_objects o ON o.id=? AND o.bucket_id=b.id WHERE r.id=? AND r.tenant_id=? AND r.committed_at IS NULL AND r.expires_at>datetime('now') LIMIT 1"
  ).bind(objectId,reservationId,user.tenantId).first<any>();
  if(!row) return NextResponse.json({error:"Upload reservation expired"},{status:409});

  const provider=createProvider(String(row.pool_key),getProviderEnv());
  const head=await provider.headObject(String(row.prefix)+String(row.object_key));
  if(!head) return NextResponse.json({error:"Uploaded object was not found"},{status:409});
  if(Number(head.size)!==Number(row.reserved_bytes)){
    await provider.deleteObject(String(row.prefix)+String(row.object_key)).catch(()=>undefined);
    await db.batch([
      db.prepare("DELETE FROM media_quota_reservations WHERE id=?").bind(reservationId),
      db.prepare("DELETE FROM media_objects WHERE id=?").bind(objectId),
    ]);
    return NextResponse.json({error:"Uploaded size did not match reservation"},{status:409});
  }

  await db.batch([
    db.prepare("UPDATE media_quota_reservations SET committed_at=datetime('now') WHERE id=?").bind(reservationId),
    db.prepare("UPDATE media_objects SET status='ready',size_bytes=?,etag=? WHERE id=?").bind(Number(head.size),head.etag||null,objectId),
    db.prepare("INSERT INTO media_usage_daily (tenant_id,usage_date,stored_bytes,uploads) VALUES (?,date('now'),0,1) ON CONFLICT(tenant_id,usage_date) DO UPDATE SET uploads=uploads+1").bind(user.tenantId),
  ]);
  return NextResponse.json({ok:true});
}
