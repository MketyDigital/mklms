import { getMediaEnv } from "../lib/postgres";

function cfg(){
  const env=getMediaEnv();
  const token=String(env.MEDIA_CF_API_TOKEN||"");
  const zoneId=String(env.MEDIA_SAAS_ZONE_ID||"");
  const cnameTarget=String(env.MEDIA_SAAS_CNAME_TARGET||"assets.mkety.app");
  if(!token||!zoneId) throw new Error("Custom-domain infrastructure is not configured");
  return {token,zoneId,cnameTarget};
}

async function cf(path:string,init:RequestInit={}){
  const {token,zoneId}=cfg();
  const response=await fetch("https://api.cloudflare.com/client/v4/zones/"+zoneId+path,{
    ...init,
    headers:{Authorization:"Bearer "+token,"content-type":"application/json",...(init.headers||{})},
  });
  const data=await response.json().catch(()=>null) as any;
  if(!response.ok||data?.success===false){
    throw new Error(String(data?.errors?.[0]?.message||data?.messages?.[0]?.message||response.status));
  }
  return data?.result;
}

export function customDomainTarget(){return cfg().cnameTarget;}

export async function createCustomHostname(hostname:string){
  return cf("/custom_hostnames",{
    method:"POST",
    body:JSON.stringify({
      hostname,
      ssl:{method:"http",type:"dv",settings:{min_tls_version:"1.2"}},
    }),
  });
}

export async function getCustomHostname(id:string){
  return cf("/custom_hostnames/"+encodeURIComponent(id));
}
