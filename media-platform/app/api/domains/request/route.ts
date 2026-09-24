import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/lib/current-user";
import { getTenantState } from "../../../../src/lib/tenant-state";
import { getMediaDb } from "../../../../src/lib/postgres";

function valid(host:string){
  const value=host.toLowerCase().replace(/\.$/,"");
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){2,}$/.test(value)&&value.length<=253;
}

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL("/login",request.url),303);
  const state=await getTenantState(user.tenantId);
  if(!state.enterpriseFeatures) return NextResponse.redirect(new URL("/domains?error=enterprise",request.url),303);
  const form=await request.formData();
  const hostname=String(form.get("hostname")||"").trim().toLowerCase().replace(/\.$/,"");
  if(!valid(hostname)) return NextResponse.redirect(new URL("/domains?error=hostname",request.url),303);
  if(hostname.endsWith(".mkety.app")||hostname.endsWith(".mkety.com")) return NextResponse.redirect(new URL("/domains?error=reserved",request.url),303);
  const db=getMediaDb();
  const exists=await db.prepare("SELECT id FROM media_custom_domains WHERE hostname=? AND status<>'removed' LIMIT 1").bind(hostname).first();
  if(exists) return NextResponse.redirect(new URL("/domains?error=exists",request.url),303);
  await db.prepare("INSERT INTO media_custom_domains (id,tenant_id,hostname,status,cname_target) VALUES (?,? ,?,'requested','assets.mkety.app')").bind(crypto.randomUUID(),user.tenantId,hostname).run();
  return NextResponse.redirect(new URL("/domains?requested=1",request.url),303);
}
