import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  if(!(await isOperator())) return NextResponse.redirect(new URL("/operator/login",request.url),303);
  const form=await request.formData();
  const code=String(form.get("code")||"");
  const db=getMediaDb();

  const values={
    name:String(form.get("name")||""),
    monthly:Number(form.get("monthly")||0),
    storageGb:Number(form.get("storageGb")||0),
    deliveryGb:Number(form.get("deliveryGb")||0),
    requests:Number(form.get("requests")||0),
    buckets:Number(form.get("buckets")||0),
    seats:Number(form.get("seats")||1),
    maxObjectGb:Math.min(5,Number(form.get("maxObjectGb")||1)),
    overage:"hard-cap",
    dedicated:form.get("dedicated")==="on"?1:0,
    active:form.get("active")==="on"?1:0,
  };

  if(!code||!values.name||values.monthly<0) return NextResponse.redirect(new URL("/operator?error=plan",request.url),303);
  await db.prepare(
    "UPDATE media_plans SET name=?,monthly_usd=?,storage_bytes=?,delivery_bytes=?,delivery_requests=?,logical_buckets=?,team_seats=?,max_object_bytes=?,overage_mode=?,dedicated_storage_eligible=?,active=?,updated_at=datetime('now') WHERE code=?"
  ).bind(values.name,values.monthly,Math.round(values.storageGb*1024**3),Math.round(values.deliveryGb*1024**3),Math.round(values.requests),Math.round(values.buckets),Math.round(values.seats),Math.round(values.maxObjectGb*1024**3),values.overage,values.dedicated,values.active,code).run();
  return NextResponse.redirect(new URL("/operator?saved=plan",request.url),303);
}
