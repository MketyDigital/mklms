const encoder=new TextEncoder();

let cachedToken:{value:string;expiresAt:number}|null=null;

export async function getFlutterwaveV4AccessToken(clientId:string,clientSecret:string){
  const now=Date.now();
  if(cachedToken&&cachedToken.expiresAt-now>60_000) return cachedToken.value;
  const body=new URLSearchParams({
    client_id:clientId,
    client_secret:clientSecret,
    grant_type:"client_credentials",
  });
  const response=await fetch("https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body,
  });
  const payload=await response.json().catch(()=>null) as any;
  if(!response.ok||!payload?.access_token) throw new Error("Flutterwave OAuth failed");
  const expiresIn=Math.max(60,Number(payload.expires_in||600));
  cachedToken={value:String(payload.access_token),expiresAt:now+expiresIn*1000};
  return cachedToken.value;
}

function base64(bytes:ArrayBuffer){
  let binary="";
  for(const b of new Uint8Array(bytes)) binary+=String.fromCharCode(b);
  return btoa(binary);
}

export async function verifyFlutterwaveV4Webhook(rawBody:string,signature:string,secret:string){
  if(!signature||!secret) return false;
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const expected=base64(await crypto.subtle.sign("HMAC",key,encoder.encode(rawBody)));
  const normalized=signature.trim();
  if(expected.length!==normalized.length) return false;
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^normalized.charCodeAt(i);
  return diff===0;
}

export async function retrieveFlutterwaveV4Charge(clientId:string,clientSecret:string,chargeId:string){
  const token=await getFlutterwaveV4AccessToken(clientId,clientSecret);
  const trace="mkm-"+crypto.randomUUID();
  const response=await fetch("https://f4bexperience.flutterwave.com/charges/"+encodeURIComponent(chargeId),{
    headers:{
      Authorization:"Bearer "+token,
      "content-type":"application/json",
      "x-trace-id":trace,
    },
  });
  const payload=await response.json().catch(()=>null) as any;
  if(!response.ok||payload?.status!=="success"||!payload?.data) return null;
  return payload.data;
}

export async function verifyFlutterwaveV3Transaction(secretKey:string,transactionId:string|number){
  const response=await fetch("https://api.flutterwave.com/v3/transactions/"+encodeURIComponent(String(transactionId))+"/verify",{
    headers:{Authorization:"Bearer "+secretKey,"content-type":"application/json"},
  });
  const payload=await response.json().catch(()=>null) as any;
  if(!response.ok||payload?.status!=="success"||!payload?.data) return null;
  return payload.data;
}


export async function verifyMketyPaymentAttestation(rawBody:string,signature:string,secret:string){
  if(!signature||!secret) return false;
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const expected=base64(await crypto.subtle.sign("HMAC",key,encoder.encode(rawBody)));
  if(expected.length!==signature.length) return false;
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
  return diff===0;
}
