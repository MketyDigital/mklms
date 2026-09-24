import { cookies } from "next/headers";
import { getMediaEnv } from "../lib/postgres";

const encoder=new TextEncoder();

async function hmac(secret:string,value:string){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,encoder.encode(value));
  return [...new Uint8Array(sig)].map((b)=>b.toString(16).padStart(2,"0")).join("");
}

export async function createOperatorCookie(){
  const env=getMediaEnv() as any;
  const secret=String(env.MEDIA_OPERATOR_SESSION_SECRET||"");
  if(secret.length<32) throw new Error("MEDIA_OPERATOR_SESSION_SECRET must be configured");
  const exp=Math.floor(Date.now()/1000)+12*60*60;
  const nonce=crypto.randomUUID();
  const payload=String(exp)+"."+nonce;
  const signature=await hmac(secret,payload);
  return "mkety_media_operator="+payload+"."+signature+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200";
}

export async function isOperator(){
  const env=getMediaEnv() as any;
  const secret=String(env.MEDIA_OPERATOR_SESSION_SECRET||"");
  if(secret.length<32) return false;
  const jar=await cookies();
  const raw=jar.get("mkety_media_operator")?.value;
  if(!raw) return false;
  const parts=raw.split(".");
  if(parts.length!==3) return false;
  const exp=Number(parts[0]);
  if(!Number.isFinite(exp) || exp<Math.floor(Date.now()/1000)) return false;
  const expected=await hmac(secret,parts[0]+"."+parts[1]);
  if(expected.length!==parts[2].length) return false;
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^parts[2].charCodeAt(i);
  return diff===0;
}

export function clearOperatorCookie(){
  return "mkety_media_operator=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}
