const encoder=new TextEncoder();

export function sortObjectDeep(value:any):any{
  if(Array.isArray(value)) return value.map(sortObjectDeep);
  if(value && typeof value==="object"){
    return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,sortObjectDeep(value[key])]));
  }
  return value;
}

function hex(bytes:ArrayBuffer){
  return [...new Uint8Array(bytes)].map((b)=>b.toString(16).padStart(2,"0")).join("");
}

export async function verifyNowPaymentsSignature(payload:any,signature:string,secret:string){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-512"},false,["sign"]);
  const canonical=JSON.stringify(sortObjectDeep(payload));
  const expected=hex(await crypto.subtle.sign("HMAC",key,encoder.encode(canonical)));
  if(expected.length!==signature.length) return false;
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
  return diff===0;
}
