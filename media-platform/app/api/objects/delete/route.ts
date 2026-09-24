import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getMediaDb } from "../../../../src/lib/postgres";
import { createProvider } from "../../../../src/providers/factory";
import { getProviderEnv } from "../../../../src/lib/provider-env";
import { allowRequest } from "../../../../src/auth/rate-limit";

export async function POST(request:Request){
  if(!(await allowRequest(request,"MEDIA_MUTATION_RATE_LIMITER","object-delete"))) return new Response("Too many requests",{status:429});
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  if(user.role==="billing") return new Response("Forbidden",{status:403});
  const form=await request.formData();
  const objectId=String(form.get("objectId")||"");
  const db=getMediaDb();
  const row=await db.prepare("SELECT o.id,o.object_key,b.id AS bucket_id,b.prefix,b.pool_key FROM media_objects o JOIN media_buckets b ON b.id=o.bucket_id WHERE o.id=? AND b.tenant_id=? AND o.status='ready' LIMIT 1").bind(objectId,user.tenantId).first<any>();
  if(!row) return NextResponse.redirect(new URL("/buckets",request.url),303);

  try{
    const provider=createProvider(String(row.pool_key),getProviderEnv());
    await provider.deleteObject(String(row.prefix)+String(row.object_key));
    await db.batch([
      db.prepare("UPDATE media_objects SET status='deleted',deleted_at=datetime('now') WHERE id=?").bind(objectId),
      db.prepare("INSERT INTO media_usage_daily (tenant_id,usage_date,deletes) VALUES (?,date('now'),1) ON CONFLICT(tenant_id,usage_date) DO UPDATE SET deletes=deletes+1").bind(user.tenantId),
      db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id) VALUES (?,?,'customer',?,'object.deleted','object',?)").bind(crypto.randomUUID(),user.tenantId,user.userId,objectId),
    ]);
  }catch(error){console.error(error);}

  return NextResponse.redirect(new URL("/buckets/"+String(row.bucket_id),request.url),303);
}
