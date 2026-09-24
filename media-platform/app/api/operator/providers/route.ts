import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { getMediaDb } from "../../../../src/lib/postgres";

export async function POST(request:Request){
  if(!(await isOperator())) return NextResponse.redirect(new URL("/operator/login",request.url),303);
  const form=await request.formData();
  const poolKey=String(form.get("poolKey")||"");
  const available=form.get("available")==="on"?1:0;
  const priority=Math.max(1,Math.min(999,Number(form.get("priority")||100)));
  await getMediaDb().prepare("UPDATE media_provider_pools SET available_to_customers=?,priority=?,updated_at=datetime('now') WHERE pool_key=?")
    .bind(available,priority,poolKey).run();
  return NextResponse.redirect(new URL("/operator?saved=provider",request.url),303);
}
