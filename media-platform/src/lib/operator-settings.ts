import { getMediaDb } from "./postgres";
import { BILLING_TERMS } from "../config/terms";

export async function getSetting<T>(key:string,fallback:T):Promise<T>{
  const row=await getMediaDb().prepare("SELECT value_json FROM media_operator_settings WHERE key=? LIMIT 1").bind(key).first<any>();
  if(!row?.value_json) return fallback;
  try{return JSON.parse(String(row.value_json)) as T;}catch{return fallback;}
}

export async function setSetting(key:string,value:unknown,updatedBy="operator"){
  await getMediaDb().prepare(
    "INSERT INTO media_operator_settings (key,value_json,updated_at,updated_by) VALUES (?,?,datetime('now'),?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=datetime('now'),updated_by=excluded.updated_by"
  ).bind(key,JSON.stringify(value),updatedBy).run();
}

export async function getBillingTerms(){
  return getSetting("billing_terms",BILLING_TERMS.map((term)=>({...term})));
}

export async function calculateTermPrice(monthlyUsd:number,months:number){
  const terms=await getBillingTerms();
  const term=(terms as any[]).find((item)=>Number(item.months)===months);
  if(!term) throw new Error("Unsupported billing term");
  const discount=Number(term.discountPercent||0);
  return Math.round(monthlyUsd*months*(1-discount/100)*100)/100;
}
