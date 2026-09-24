import { getCloudflareContext } from "@opennextjs/cloudflare";

type Limiter={limit(input:{key:string}):Promise<{success:boolean}>};

function clientIp(request:Request){
  return request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
}

export async function allowRequest(
  request:Request,
  binding:"MEDIA_AUTH_RATE_LIMITER"|"MEDIA_MUTATION_RATE_LIMITER",
  scope:string,
){
  try{
    const context=getCloudflareContext();
    const env=context.env as unknown as Record<string,Limiter|undefined>;
    const limiter=env[binding];
    if(!limiter) return true;
    const result=await limiter.limit({key:scope+":"+clientIp(request)});
    return result.success;
  }catch{
    return true;
  }
}
