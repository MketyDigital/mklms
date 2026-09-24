import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../src/lib/current-user";
import { getTenantState } from "../../../src/lib/tenant-state";
import { getMediaDb, getMediaEnv } from "../../../src/lib/postgres";
import { configuredProviders } from "../../../src/config/providers";
import { getProviderEnv } from "../../../src/lib/provider-env";
import { allowMutation } from "../../../src/lib/rate-limit";
import { allowRequest } from "../../../src/auth/rate-limit";

function slugify(input:string){
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,50);
}

export async function POST(request:Request){
  if(!(await allowRequest(request,"MEDIA_MUTATION_RATE_LIMITER","bucket-create"))) return new Response("Too many requests",{status:429});
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  if(!(await allowMutation(user.userId))) return NextResponse.redirect(new URL("/buckets?error=rate",request.url),303);
  if(user.role==="billing") return new Response("Forbidden",{status:403});

  const state=await getTenantState(user.tenantId);
  if(state.status!=="active" || state.subscriptionStatus!=="active") return NextResponse.redirect(new URL("/billing",request.url),303);
  if(state.bucketsUsed>=state.bucketLimit) return NextResponse.redirect(new URL("/buckets?error=limit",request.url),303);

  const form=await request.formData();
  const name=String(form.get("name")||"");
  const slug=slugify(name);
  if(!slug) return NextResponse.redirect(new URL("/buckets?error=name",request.url),303);

  const db=getMediaDb();
  const id=crypto.randomUUID();
  let poolKey="r2-global";
  if(state.enterpriseFeatures && state.preferredPoolKey){
    const requested=String(state.preferredPoolKey);
    const pool=await db.prepare("SELECT available_to_customers FROM media_provider_pools WHERE pool_key=? LIMIT 1").bind(requested).first<any>();
    const provider=configuredProviders(getProviderEnv()).find((item)=>item.id===requested);
    if(pool?.available_to_customers && provider?.status==="active") poolKey=requested;
  }
  const prefix="tenants/"+user.tenantId+"/buckets/"+id+"/";
  const cacheControl="public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400";

  try{
    await db.prepare("INSERT INTO media_buckets (id,tenant_id,slug,pool_key,prefix,cache_control) VALUES (?,?,?,?,?,?)")
      .bind(id,user.tenantId,slug,poolKey,prefix,cacheControl).run();

    const directory=getMediaEnv().BUCKET_DIRECTORY;
    if(directory){
      await directory.put(user.tenantSlug+"/"+slug,JSON.stringify({
        tenantId:user.tenantId,
        bucketId:id,
        poolKey,
        prefix,
        cacheControl,
        deliveryBlocked:false,
      }));
    }

    await db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id) VALUES (?,?,'customer',?,'bucket.created','bucket',?)")
      .bind(crypto.randomUUID(),user.tenantId,user.userId,id).run();

    return NextResponse.redirect(new URL("/buckets/"+id,request.url),303);
  }catch{
    return NextResponse.redirect(new URL("/buckets?error=exists",request.url),303);
  }
}
