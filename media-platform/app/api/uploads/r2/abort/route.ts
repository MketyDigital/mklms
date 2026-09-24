import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../src/lib/current-user";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});

  const body=await request.json().catch(()=>null) as any;
  const reservationId=String(body?.reservationId||"");
  if(!reservationId) return NextResponse.json({ok:true});

  const db=getMediaDb();
  const reservation=await db.prepare(
    "SELECT provider_upload_id,storage_key,reservation_key FROM media_quota_reservations WHERE id=? AND tenant_id=? AND committed_at IS NULL LIMIT 1"
  ).bind(reservationId,user.tenantId).first<any>();

  if(reservation?.provider_upload_id&&reservation?.storage_key&&getMediaEnv().MEDIA_R2_BUCKET){
    try{
      await getMediaEnv().MEDIA_R2_BUCKET!.resumeMultipartUpload(String(reservation.storage_key),String(reservation.provider_upload_id)).abort();
    }catch{}
  }

  if(reservation){
    await db.batch([
      db.prepare("DELETE FROM media_objects WHERE id=? AND status='pending'").bind(String(reservation.reservation_key)),
      db.prepare("DELETE FROM media_quota_reservations WHERE id=? AND committed_at IS NULL").bind(reservationId),
    ]);
  }
  return NextResponse.json({ok:true});
}
