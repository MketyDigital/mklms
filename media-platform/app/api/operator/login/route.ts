import { NextResponse } from "next/server";
import { createOperatorCookie } from "../../../../src/auth/operator";
import { getMediaEnv } from "../../../../src/lib/postgres";
import { allowRequest } from "../../../../src/auth/rate-limit";

function equal(a:string,b:string){
  if(a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i); return diff===0;
}

export async function POST(request:Request){
  if(!(await allowRequest(request,"MEDIA_AUTH_RATE_LIMITER","operator-login"))) return new Response("Too many requests",{status:429});
  const form=await request.formData();
  const supplied=String(form.get("accessKey")||"");
  const expected=String((getMediaEnv() as any).MEDIA_OPERATOR_ACCESS_KEY||"");
  if(expected.length<24 || !equal(supplied,expected)) return NextResponse.redirect(new URL("/operator/login?error=1",request.url),303);
  const response=NextResponse.redirect(new URL("/operator",request.url),303);
  response.headers.set("Set-Cookie",await createOperatorCookie());
  return response;
}
