import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { getMediaDb, getMediaEnv } from "../../../../src/lib/postgres";

function gb(value:FormDataEntryValue|null){
  const n=Number(value||0);
  return Number.isFinite(n)&&n>=0?Math.round(n*1024**3):null;
}

export async function POST(request:Request){
  if(!(await isOperator())) return NextResponse.redirect(new URL("/operator/login",request.url),303);
  const form=await request.formData();
  const tenantId=String(form.get("tenantId")||"");
  const status=String(form.get("status")||"active");
  const requestedSlug=String(form.get("slug")||"").toLowerCase().trim();
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(requestedSlug)) return NextResponse.redirect(new URL("/operator?error=slug",request.url),303);
  const db=getMediaDb();
  const current=await db.prepare("SELECT plan_code,slug FROM media_tenants WHERE id=? LIMIT 1").bind(tenantId).first<any>();
  if(!current) return NextResponse.redirect(new URL("/operator?error=tenant",request.url),303);

  const customPriceRaw=String(form.get("monthlyUsd")||"").trim();
  const displayName=String(form.get("displayName")||"").trim();
  const term=Number(form.get("term")||1);
  const infrastructure=String(form.get("infrastructure")||"automatic");
  const enterprise=form.get("enterprise")==="on"?1:0;

  const buckets=await db.prepare("SELECT id,slug,pool_key,prefix,cache_control FROM media_buckets WHERE tenant_id=?").bind(tenantId).all<any>();

  await db.batch([
    db.prepare("UPDATE media_tenants SET status=?,slug=? WHERE id=?").bind(status,requestedSlug,tenantId),
    db.prepare(
      "INSERT INTO media_tenant_commercial_terms (tenant_id,base_plan_code,display_name,monthly_usd,storage_bytes,delivery_bytes,delivery_requests,logical_buckets,team_seats,max_object_bytes,overage_mode,enterprise_features,infrastructure_mode,preferred_pool_key,billing_term_months,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(tenant_id) DO UPDATE SET display_name=excluded.display_name,monthly_usd=excluded.monthly_usd,storage_bytes=excluded.storage_bytes,delivery_bytes=excluded.delivery_bytes,delivery_requests=excluded.delivery_requests,logical_buckets=excluded.logical_buckets,team_seats=excluded.team_seats,max_object_bytes=excluded.max_object_bytes,overage_mode=excluded.overage_mode,enterprise_features=excluded.enterprise_features,infrastructure_mode=excluded.infrastructure_mode,preferred_pool_key=excluded.preferred_pool_key,billing_term_months=excluded.billing_term_months,updated_at=datetime('now')"
    ).bind(
      tenantId,
      String(current.plan_code),
      displayName||null,
      customPriceRaw===""?null:Number(customPriceRaw),
      gb(form.get("storageGb")),
      gb(form.get("deliveryGb")),
      form.get("requests")?Number(form.get("requests")):null,
      form.get("buckets")?Number(form.get("buckets")):null,
      form.get("seats")?Number(form.get("seats")):null,
      Math.min(5*1024**3,gb(form.get("maxObjectGb")) ?? 5*1024**3),
      "hard-cap",
      enterprise,
      infrastructure,
      String(form.get("preferredPoolKey")||"r2-global"),
      [1,3,6,12].includes(term)?term:1,
    ),
    db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id) VALUES (?,?,'operator','operator','tenant.commercial.updated','tenant',?)")
      .bind(crypto.randomUUID(),tenantId,tenantId),
  ]);
  const directory=getMediaEnv().BUCKET_DIRECTORY;
  if(directory && String(current.slug)!==requestedSlug){
    for(const bucket of buckets.results||[]){
      const oldKey=String(current.slug)+"/"+String(bucket.slug);
      const newKey=requestedSlug+"/"+String(bucket.slug);
      await directory.put(newKey,JSON.stringify({
        tenantId,
        bucketId:String(bucket.id),
        poolKey:String(bucket.pool_key),
        prefix:String(bucket.prefix),
        cacheControl:String(bucket.cache_control),
        deliveryBlocked:status==="suspended"||status==="closed",
      }));
      await directory.delete(oldKey);
    }
  }

  return NextResponse.redirect(new URL("/operator?saved=tenant",request.url),303);
}
