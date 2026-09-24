import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>null) as any;
  const reservationId=String(body?.reservationId||"");
  const objectId=String(body?.objectId||"");
  if(!reservationId||!objectId) return NextResponse.json({error:"Invalid request"},{status:400});

  const db=getMediaDb();
  const row=await db.prepare("SELECT r.id FROM media_quota_reservations r JOIN media_buckets b ON b.id=r.bucket_id JOIN media_objects o ON o.id=? AND o.bucket_id=b.id WHERE r.id=? AND r.tenant_id=? AND r.committed_at IS NULL AND r.expires_at>datetime('now') LIMIT 1")
    .bind(objectId,reservationId,user.tenantId).first();
  if(!row) return NextResponse.json({error:"Upload reservation expired"},{status:409});

  await db.batch([
    db.prepare("UPDATE media_quota_reservations SET committed_at=datetime('now') WHERE id=?").bind(reservationId),
    db.prepare("UPDATE media_objects SET status='ready' WHERE id=?").bind(objectId),
    db.prepare("INSERT INTO media_usage_daily (tenant_id,usage_date,stored_bytes,uploads) VALUES (?,date('now'),0,1) ON CONFLICT(tenant_id,usage_date) DO UPDATE SET uploads=uploads+1").bind(user.tenantId),
  ]);
  return NextResponse.json({ok:true});
}
