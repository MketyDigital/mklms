import { NextResponse } from "next/server";
import { clearOperatorCookie } from "../../../../src/auth/operator";

export async function POST(request:Request){
  const response=NextResponse.redirect(new URL("/operator/login",request.url),303);
  response.headers.set("Set-Cookie",clearOperatorCookie());
  return response;
}
