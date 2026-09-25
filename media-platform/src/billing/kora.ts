const encoder=new TextEncoder();

function hex(bytes:ArrayBuffer){
  return [...new Uint8Array(bytes)].map((b)=>b.toString(16).padStart(2,"0")).join("");
}

export async function verifyKoraWebhook(data:any,signature:string,secretKey:string){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secretKey),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const expected=hex(await crypto.subtle.sign("HMAC",key,encoder.encode(JSON.stringify(data))));
  if(expected.length!==signature.length) return false;
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
  return diff===0;
}

export async function verifyKoraCharge(secretKey:string,reference:string){
  const response=await fetch("https://api.korapay.com/merchant/api/v1/charges/"+encodeURIComponent(reference),{
    headers:{Authorization:"Bearer "+secretKey,"content-type":"application/json"},
  });
  const payload=await response.json().catch(()=>null) as any;
  if(!response.ok || payload?.status!==true || !payload?.data) return null;
  return payload.data;
}
