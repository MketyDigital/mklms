import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../src/lib/current-user";
import { getTenantState } from "../../../src/lib/tenant-state";
import { getMediaDb, getMediaEnv } from "../../../src/lib/postgres";

function slugify(input:string){
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,50);
}

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);

  const state=await getTenantState(user.tenantId);
  if(state.status!=="active") return NextResponse.redirect(new URL("/billing",request.url),303);
  if(state.bucketsUsed>=state.bucketLimit) return NextResponse.redirect(new URL("/buckets?error=limit",request.url),303);

  const form=await request.formData();
  const name=String(form.get("name")||"");
  const slug=slugify(name);
  if(!slug) return NextResponse.redirect(new URL("/buckets?error=name",request.url),303);

  const db=getMediaDb();
  const id=crypto.randomUUID();
  const poolKey=String((getMediaEnv() as any).MEDIA_DEFAULT_POOL_KEY || "r2-global");
  const prefix="tenants/"+user.tenantId+"/buckets/"+id+"/";
  const cacheControl="public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400";

  try{
    await db.prepare("INSERT INTO media_buckets (id,tenant_id,slug,pool_key,prefix,cache_control) VALUES (?,?,?,?,?,?)")
      .bind(id,user.tenantId,slug,poolKey,prefix,cacheControl).run();

    const directory=getMediaEnv().BUCKET_DIRECTORY;
    if(directory){
      await directory.put(user.tenantSlug+"/"+slug,JSON.stringify({
        poolKey,
        prefix,
        cacheControl,
      }));
    }

    await db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id) VALUES (?,?,'customer',?,'bucket.created','bucket',?)")
      .bind(crypto.randomUUID(),user.tenantId,user.userId,id).run();

    return NextResponse.redirect(new URL("/buckets/"+id,request.url),303);
  }catch{
    return NextResponse.redirect(new URL("/buckets?error=exists",request.url),303);
  }
}
