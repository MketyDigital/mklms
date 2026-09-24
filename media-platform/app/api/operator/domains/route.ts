import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { getMediaDb,getMediaEnv } from "../../../../src/lib/postgres";
import { createCustomHostname,getCustomHostname,customDomainTarget,ensureCustomHostnameWorkerRoute } from "../../../../src/domains/cloudflare-saas";

function verification(result:any){
  const ownership=result?.ownership_verification||{};
  return {
    name:ownership.name?String(ownership.name):null,
    type:ownership.type?String(ownership.type):null,
    value:ownership.value?String(ownership.value):null,
  };
}

export async function POST(request:Request){
  if(!(await isOperator())) return NextResponse.redirect(new URL("/operator/login",request.url),303);
  const form=await request.formData();
  const id=String(form.get("id")||"");
  const action=String(form.get("action")||"provision");
  const db=getMediaDb();
  const row=await db.prepare("SELECT d.*,t.slug AS tenant_slug FROM media_custom_domains d JOIN media_tenants t ON t.id=d.tenant_id WHERE d.id=? LIMIT 1").bind(id).first<any>();
  if(!row) return NextResponse.redirect(new URL("/operator?error=domain",request.url),303);

  try{
    let result:any;
    if(action==="provision"){
      result=await createCustomHostname(String(row.hostname));
      const v=verification(result);
      await db.prepare("UPDATE media_custom_domains SET status='provisioning',cf_hostname_id=?,ssl_status=?,ownership_name=?,ownership_type=?,ownership_value=?,cname_target=?,last_error=NULL,updated_at=datetime('now') WHERE id=?")
        .bind(String(result.id||""),String(result.ssl?.status||"pending"),v.name,v.type,v.value,customDomainTarget(),id).run();
    }else if(action==="refresh"){
      if(!row.cf_hostname_id) throw new Error("Provision this hostname first");
      result=await getCustomHostname(String(row.cf_hostname_id));
      const v=verification(result);
      const active=String(result.status)==="active"&&String(result.ssl?.status)==="active";
      let routeId=row.cf_route_id?String(row.cf_route_id):null;
      if(active){
        routeId=await ensureCustomHostnameWorkerRoute(String(row.hostname));
      }
      await db.prepare("UPDATE media_custom_domains SET status=?,ssl_status=?,ownership_name=?,ownership_type=?,ownership_value=?,cf_route_id=?,last_error=NULL,updated_at=datetime('now') WHERE id=?")
        .bind(active?"active":"pending_dns",String(result.ssl?.status||"pending"),v.name,v.type,v.value,routeId,id).run();
      if(active&&getMediaEnv().BUCKET_DIRECTORY){
        await getMediaEnv().BUCKET_DIRECTORY!.put("domain/"+String(row.hostname).toLowerCase(),JSON.stringify({tenantSlug:String(row.tenant_slug),tenantId:String(row.tenant_id)}));
      }
    }
  }catch(error:any){
    await db.prepare("UPDATE media_custom_domains SET status='failed',last_error=?,updated_at=datetime('now') WHERE id=?").bind(String(error?.message||"Provisioning failed").slice(0,500),id).run();
  }
  return NextResponse.redirect(new URL("/operator?saved=domain",request.url),303);
}
