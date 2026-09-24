import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  if(!(await isOperator())) return NextResponse.redirect(new URL("/operator/login",request.url),303);
  const form=await request.formData();
  const code=String(form.get("code")||"");
  const name=String(form.get("name")||"").trim();
  const price=Math.max(0,Number(form.get("priceUsd")||0));
  const storageGb=Math.max(0,Number(form.get("storageGb")||0));
  const deliveryGb=Math.max(0,Number(form.get("deliveryGb")||0));
  const requests=Math.max(0,Math.floor(Number(form.get("requests")||0)));
  const active=form.get("active")==="on"?1:0;
  if(!code||!name) return NextResponse.redirect(new URL("/operator?error=addon",request.url),303);

  await getMediaDb().prepare(
    "UPDATE media_addon_products SET name=?,price_usd=?,storage_bytes=?,delivery_bytes=?,delivery_requests=?,active=?,updated_at=datetime('now') WHERE code=?"
  ).bind(name,price,Math.round(storageGb*1024**3),Math.round(deliveryGb*1024**3),requests,active,code).run();

  return NextResponse.redirect(new URL("/operator?saved=addon",request.url),303);
}
