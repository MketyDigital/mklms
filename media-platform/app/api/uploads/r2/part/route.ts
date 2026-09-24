import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../src/lib/current-user";
import { getMediaDb,getMediaEnv } from "../../../../../src/lib/postgres";

export async function PUT(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(user.role==="billing") return NextResponse.json({error:"Forbidden"},{status:403});

  const url=new URL(request.url);
  const reservationId=url.searchParams.get("reservationId")||"";
  const partNumber=Number(url.searchParams.get("partNumber")||0);
  if(!reservationId||!Number.isInteger(partNumber)||partNumber<1||partNumber>10000){
    return NextResponse.json({error:"Invalid part"},{status:400});
  }

  const db=getMediaDb();
  const reservation=await db.prepare(
    "SELECT r.provider_upload_id,r.storage_key FROM media_quota_reservations r WHERE r.id=? AND r.tenant_id=? AND r.committed_at IS NULL AND r.expires_at>datetime('now') LIMIT 1"
  ).bind(reservationId,user.tenantId).first<any>();
  if(!reservation?.provider_upload_id||!reservation?.storage_key) return NextResponse.json({error:"Upload expired"},{status:409});

  const bucket=getMediaEnv().MEDIA_R2_BUCKET;
  if(!bucket) return NextResponse.json({error:"R2 unavailable"},{status:503});

  const body=await request.arrayBuffer();
  if(body.byteLength<=0 || body.byteLength>25*1024*1024) return NextResponse.json({error:"Invalid chunk size"},{status:413});

  const multipart=bucket.resumeMultipartUpload(String(reservation.storage_key),String(reservation.provider_upload_id));
  const uploaded=await multipart.uploadPart(partNumber,body);
  return NextResponse.json({partNumber:uploaded.partNumber,etag:uploaded.etag});
}
