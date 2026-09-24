import { createProvider } from "../src/providers/factory";
import type { MediaProviderEnv } from "../src/config/providers";

export interface Env extends MediaProviderEnv {
  BUCKET_DIRECTORY: KVNamespace;
  MEDIA_R2_BUCKET?: R2Bucket;
  MEDIA_USAGE_ANALYTICS?: AnalyticsEngineDataset;
  MEDIA_ASSET_PURGE_SECRET?: string;
}

type BucketRoute = {
  tenantId:string;
  bucketId:string;
  poolKey:string;
  prefix:string;
  cacheControl?:string;
  deliveryBlocked?:boolean;
};

function objectHeaders(object:R2ObjectBody){
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag",object.httpEtag);
  headers.set("accept-ranges","bytes");
  return headers;
}

function recordUsage(env:Env,route:BucketRoute,bytes:number){
  if(!env.MEDIA_USAGE_ANALYTICS) return;
  env.MEDIA_USAGE_ANALYTICS.writeDataPoint({
    blobs:[route.tenantId,route.bucketId],
    doubles:[1,Math.max(0,bytes)],
    indexes:[route.tenantId],
  });
}

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const url=new URL(request.url);

    if(request.method==="POST" && url.pathname==="/_mkety/purge"){
      const provided=request.headers.get("x-mkety-purge-secret")||"";
      const expected=env.MEDIA_ASSET_PURGE_SECRET||"";
      if(!expected || provided.length!==expected.length){
        return new Response("Unauthorized",{status:401});
      }
      let diff=0;
      for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^provided.charCodeAt(i);
      if(diff!==0) return new Response("Unauthorized",{status:401});

      const body=await request.json().catch(()=>null) as {url?:string}|null;
      if(!body?.url) return new Response("Bad Request",{status:400});
      const target=new URL(body.url);
      if(target.origin!==url.origin) return new Response("Bad Request",{status:400});
      const cache=(caches as CacheStorage & { default: Cache }).default;
      const deleted=await cache.delete(new Request(target.toString(),{method:"GET"}));
      return Response.json({ok:true,deleted});
    }

    if(request.method!=="GET" && request.method!=="HEAD") return new Response("Method Not Allowed",{status:405});
    const parts=url.pathname.split("/").filter(Boolean);
    const hostname=url.hostname.toLowerCase();
    let tenantSlug:string;
    let bucketSlug:string;
    let keyParts:string[];

    if(hostname==="assets.mkety.app"){
      if(parts.length<3) return new Response("Not Found",{status:404});
      [tenantSlug,bucketSlug,...keyParts]=parts;
    }else{
      if(parts.length<2) return new Response("Not Found",{status:404});
      const mapped=await env.BUCKET_DIRECTORY.get<{tenantSlug:string}>("domain/"+hostname,"json");
      if(!mapped?.tenantSlug) return new Response("Not Found",{status:404});
      tenantSlug=String(mapped.tenantSlug);
      [bucketSlug,...keyParts]=parts;
    }

    const objectKey=keyParts.join("/");
    const route=await env.BUCKET_DIRECTORY.get<BucketRoute>(tenantSlug+"/"+bucketSlug,"json");
    if(!route || route.deliveryBlocked) return new Response("Not Found",{status:404});

    const range=request.headers.get("range");
    const canCache=request.method==="GET" && !range;
    const cache=(caches as CacheStorage & { default: Cache }).default;
    const cacheKey=new Request(url.toString(),{method:"GET"});

    if(canCache){
      const cached=await cache.match(cacheKey);
      if(cached){
        const response=new Response(cached.body,cached);
        const bytes=Number(response.headers.get("content-length")||0);
        recordUsage(env,route,bytes);
        response.headers.set("X-Mkety-Cache","HIT");
        return response;
      }
    }

    const storageKey=route.prefix+objectKey;
    let response:Response;

    if(route.poolKey==="r2-global" && env.MEDIA_R2_BUCKET){
      let rangeOption:R2Range|undefined;
      if(range && /^bytes=\d*-\d*$/.test(range)){
        const match=range.match(/^bytes=(\d*)-(\d*)$/);
        if(match){
          const start=match[1]?Number(match[1]):undefined;
          const end=match[2]?Number(match[2]):undefined;
          if(start!==undefined){
            rangeOption=end!==undefined?{offset:start,length:end-start+1}:{offset:start};
          }
        }
      }
      const object=await env.MEDIA_R2_BUCKET.get(storageKey,rangeOption?{range:rangeOption}:undefined);
      if(!object) return new Response("Not Found",{status:404});
      const headers=objectHeaders(object);
      headers.set("Cache-Control",route.cacheControl||"public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600");
      if(range && object.range && "offset" in object.range && "length" in object.range){
        const offset=Number(object.range.offset ?? 0);
        const length=Number(object.range.length ?? 0);
        headers.set("content-range","bytes "+offset+"-"+(offset+length-1)+"/"+object.size);
        headers.set("content-length",String(length));
        response=new Response(request.method==="HEAD"?null:object.body,{status:206,headers});
      }else{
        headers.set("content-length",String(object.size));
        response=new Response(request.method==="HEAD"?null:object.body,{status:200,headers});
      }
    }else{
      const provider=createProvider(route.poolKey,env);
      const signed=await provider.createDownloadUrl({key:storageKey,expiresInSeconds:300});
      const headers=new Headers();
      if(range) headers.set("range",range);
      const upstream=await fetch(signed,{method:request.method,headers});
      if(!upstream.ok) return new Response("Not Found",{status:upstream.status});
      response=new Response(upstream.body,upstream);
      response.headers.set("Cache-Control",route.cacheControl||"public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600");
    }

    response.headers.set("X-Content-Type-Options","nosniff");
    response.headers.set("X-Mkety-Cache","MISS");
    const bytes=Number(response.headers.get("content-length")||0);
    recordUsage(env,route,request.method==="GET"?bytes:0);

    if(canCache && response.status===200){
      ctx.waitUntil(cache.put(cacheKey,response.clone()));
    }
    return response;
  }
};
