import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../src/lib/current-user";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(user.role==="billing") return NextResponse.json({error:"Forbidden"},{status:403});

  const body=await request.json().catch(()=>null) as any;
  const reservationId=String(body?.reservationId||"");
  const objectId=String(body?.objectId||"");
  const parts=Array.isArray(body?.parts)?body.parts:[];
  if(!reservationId||!objectId||!parts.length) return NextResponse.json({error:"Invalid completion"},{status:400});

  const db=getMediaDb();
  const reservation=await db.prepare(
    "SELECT r.provider_upload_id,r.storage_key,r.bucket_id FROM media_quota_reservations r JOIN media_objects o ON o.id=? AND o.bucket_id=r.bucket_id WHERE r.id=? AND r.tenant_id=? AND r.committed_at IS NULL AND r.expires_at>datetime('now') LIMIT 1"
  ).bind(objectId,reservationId,user.tenantId).first<any>();
  if(!reservation?.provider_upload_id||!reservation?.storage_key) return NextResponse.json({error:"Upload expired"},{status:409});

  const normalized=parts.map((part:any)=>({partNumber:Number(part.partNumber),etag:String(part.etag||"")})).filter((p:any)=>Number.isInteger(p.partNumber)&&p.partNumber>0&&p.etag);
  if(normalized.length!==parts.length) return NextResponse.json({error:"Invalid parts"},{status:400});

  const bucket=getMediaEnv().MEDIA_R2_BUCKET;
  if(!bucket) return NextResponse.json({error:"R2 unavailable"},{status:503});

  const multipart=bucket.resumeMultipartUpload(String(reservation.storage_key),String(reservation.provider_upload_id));
  await multipart.complete(normalized);

  await db.batch([
    db.prepare("UPDATE media_quota_reservations SET committed_at=datetime('now') WHERE id=?").bind(reservationId),
    db.prepare("UPDATE media_objects SET status='ready' WHERE id=?").bind(objectId),
    db.prepare("INSERT INTO media_usage_daily (tenant_id,usage_date,uploads) VALUES (?,date('now'),1) ON CONFLICT(tenant_id,usage_date) DO UPDATE SET uploads=uploads+1").bind(user.tenantId),
  ]);

  return NextResponse.json({ok:true});
}
