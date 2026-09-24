import { getMediaEnv } from "./postgres";

export async function allowAuthAttempt(key:string){
  const limiter=getMediaEnv().MEDIA_AUTH_RATE_LIMITER;
  if(!limiter) return true;
  const result=await limiter.limit({key:"auth:"+key.toLowerCase()});
  return result.success;
}

export async function allowMutation(key:string){
  const limiter=getMediaEnv().MEDIA_MUTATION_RATE_LIMITER;
  if(!limiter) return true;
  const result=await limiter.limit({key:"mutation:"+key});
  return result.success;
}
