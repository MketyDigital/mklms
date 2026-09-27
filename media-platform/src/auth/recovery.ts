export function newRecoveryToken(bytes=32){
  const data=new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data,(b)=>b.toString(16).padStart(2,"0")).join("");
}

export async function recoveryTokenHash(token:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),(b)=>b.toString(16).padStart(2,"0")).join("");
}
