const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 10_000;
const CHAIN_ROUNDS = 12;

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

function roundSalt(base:Uint8Array,round:number){
  const suffix=new Uint8Array(4);
  new DataView(suffix.buffer).setUint32(0,round,false);
  const combined=new Uint8Array(base.length+suffix.length);
  combined.set(base,0);
  combined.set(suffix,base.length);
  return combined;
}

async function deriveRound(materialBytes:Uint8Array,salt:Uint8Array){
  const material=await crypto.subtle.importKey(
    "raw",
    materialBytes,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(await crypto.subtle.deriveBits(
    {name:"PBKDF2",hash:"SHA-256",salt,iterations:PBKDF2_ITERATIONS},
    material,
    256,
  ));
}

async function deriveChained(password:string,salt:Uint8Array,rounds:number){
  let material=encoder.encode(password);
  for(let round=0;round<rounds;round+=1){
    material=await deriveRound(material,roundSalt(salt,round));
  }
  return material;
}

function constantTimeEqual(a:Uint8Array,b:Uint8Array){
  if(a.length!==b.length) return false;
  let diff=0;
  for(let i=0;i<a.length;i+=1) diff|=a[i]^b[i];
  return diff===0;
}

export async function hashPassword(password:string){
  if(password.length<10) throw new Error("Password must be at least 10 characters.");
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const derived=await deriveChained(password,salt,CHAIN_ROUNDS);
  return `pbkdf2-chain-sha256$${CHAIN_ROUNDS}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

export async function verifyPassword(password:string,stored:string){
  const parts=stored.split("$");

  if(parts[0]==="pbkdf2-chain-sha256"){
    const rounds=Number(parts[1]);
    const iterations=Number(parts[2]);
    if(!Number.isInteger(rounds)||rounds<1||rounds>64) return false;
    if(iterations!==PBKDF2_ITERATIONS) return false;
    const salt=fromBase64(parts[3]||"");
    const expected=fromBase64(parts[4]||"");
    const derived=await deriveChained(password,salt,rounds);
    return constantTimeEqual(derived,expected);
  }

  // Backward compatibility for any early hashes created with a Worker-supported
  // single PBKDF2 round. Values above the Workers runtime limit are rejected.
  if(parts[0]==="pbkdf2-sha256"){
    const iterations=Number(parts[1]);
    if(!Number.isInteger(iterations)||iterations<1||iterations>PBKDF2_ITERATIONS) return false;
    const salt=fromBase64(parts[2]||"");
    const expected=fromBase64(parts[3]||"");
    const material=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
    const derived=new Uint8Array(await crypto.subtle.deriveBits(
      {name:"PBKDF2",hash:"SHA-256",salt,iterations},
      material,
      256,
    ));
    return constantTimeEqual(derived,expected);
  }

  return false;
}
