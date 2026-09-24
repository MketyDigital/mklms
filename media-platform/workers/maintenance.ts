interface Env {
  MEDIA_DB:D1Database;
  BUCKET_DIRECTORY:KVNamespace;
  CLOUDFLARE_ACCOUNT_ID?:string;
  CLOUDFLARE_API_TOKEN?:string;
}

type UsageRow={
  tenantId:string;
  day:string;
  requests:number;
  bytes:number;
};

function uid(){return crypto.randomUUID();}

async function analyticsRows(env:Env):Promise<UsageRow[]>{
  if(!env.CLOUDFLARE_ACCOUNT_ID||!env.CLOUDFLARE_API_TOKEN) return [];
  const sql=[
    "SELECT blob1 AS tenantId, toDate(timestamp) AS day,",
    "SUM(double1 * _sample_interval) AS requests,",
    "SUM(double2 * _sample_interval) AS bytes",
    "FROM mkety_media_usage",
    "WHERE timestamp >= toStartOfMonth(now())",
    "GROUP BY tenantId, day",
    "ORDER BY day ASC"
  ].join(" ");
  const response=await fetch("https://api.cloudflare.com/client/v4/accounts/"+env.CLOUDFLARE_ACCOUNT_ID+"/analytics_engine/sql",{
    method:"POST",
    headers:{Authorization:"Bearer "+env.CLOUDFLARE_API_TOKEN},
    body:sql,
  });
  if(!response.ok) throw new Error("Analytics Engine query failed: "+response.status);
  const payload=await response.json() as any;
  return Array.isArray(payload?.data)?payload.data.map((row:any)=>({
    tenantId:String(row.tenantId||""),
    day:String(row.day||""),
    requests:Math.round(Number(row.requests)||0),
    bytes:Math.round(Number(row.bytes)||0),
  })).filter((row:UsageRow)=>row.tenantId&&row.day):[];
}

async function syncUsage(env:Env){
  const rows=await analyticsRows(env);
  for(const row of rows){
    await env.MEDIA_DB.prepare(
      "INSERT INTO media_usage_daily (tenant_id,usage_date,delivery_requests,delivered_bytes) VALUES (?,?,?,?) ON CONFLICT(tenant_id,usage_date) DO UPDATE SET delivery_requests=excluded.delivery_requests,delivered_bytes=excluded.delivered_bytes"
    ).bind(row.tenantId,row.day,row.requests,row.bytes).run();
  }
}

async function getSetting(env:Env,key:string,fallback:any){
  const row=await env.MEDIA_DB.prepare("SELECT value_json FROM media_operator_settings WHERE key=? LIMIT 1").bind(key).first<any>();
  if(!row?.value_json) return fallback;
  try{return JSON.parse(String(row.value_json));}catch{return fallback;}
}

function addMonths(date:Date,months:number){
  const next=new Date(date); const day=next.getUTCDate();
  next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth()+months);
  const maxDay=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
  next.setUTCDate(Math.min(day,maxDay)); return next;
}

async function ensureRenewalInvoice(env:Env,tenant:any,terms:any[]){
  if(!tenant.current_period_end) return;
  const end=new Date(String(tenant.current_period_end));
  if(end.getTime()-Date.now()>7*24*60*60*1000) return;

  const existing=await env.MEDIA_DB.prepare(
    "SELECT id FROM media_invoices WHERE tenant_id=? AND status='pending' AND created_at>=datetime(?,'-14 days') LIMIT 1"
  ).bind(String(tenant.id),String(tenant.current_period_end)).first();
  if(existing) return;

  const months=Number(tenant.billing_term_months||1);
  const term=terms.find((item:any)=>Number(item.months)===months)||{discountPercent:0};
  const monthly=Number(tenant.custom_monthly_usd??tenant.monthly_usd);
  const amount=Math.round(monthly*months*(1-Number(term.discountPercent||0)/100)*100)/100;
  const reference="MKM-"+uid().replace(/-/g,"").slice(0,10).toUpperCase();
  await env.MEDIA_DB.prepare(
    "INSERT INTO media_invoices (id,tenant_id,reference,amount_usd,payment_method,status,due_at) VALUES (?,?,?,?,'invoice','pending',?)"
  ).bind(uid(),String(tenant.id),reference,amount,String(tenant.current_period_end)).run();
}

async function syncTenantRouteBlock(env:Env,tenantId:string,blocked:boolean){
  const buckets=await env.MEDIA_DB.prepare("SELECT id,slug,pool_key,prefix,cache_control FROM media_buckets WHERE tenant_id=?").bind(tenantId).all<any>();
  const tenant=await env.MEDIA_DB.prepare("SELECT slug FROM media_tenants WHERE id=? LIMIT 1").bind(tenantId).first<any>();
  if(!tenant) return;
  for(const bucket of buckets.results||[]){
    await env.BUCKET_DIRECTORY.put(String(tenant.slug)+"/"+String(bucket.slug),JSON.stringify({
      tenantId,
      bucketId:String(bucket.id),
      poolKey:String(bucket.pool_key),
      prefix:String(bucket.prefix),
      cacheControl:String(bucket.cache_control),
      deliveryBlocked:blocked,
    }));
  }
}

async function enforce(env:Env){
  const enforcement=await getSetting(env,"enforcement",{graceDays:3,suspendDeliveryAfterGrace:true});
  const terms=await getSetting(env,"billing_terms",[
    {months:1,discountPercent:0},{months:3,discountPercent:3},{months:6,discountPercent:5},{months:12,discountPercent:8}
  ]);

  const tenants=await env.MEDIA_DB.prepare(
    "SELECT t.id,t.status,p.monthly_usd,p.storage_bytes,p.delivery_bytes,p.delivery_requests,c.monthly_usd AS custom_monthly_usd,c.storage_bytes AS custom_storage_bytes,c.delivery_bytes AS custom_delivery_bytes,c.delivery_requests AS custom_delivery_requests,c.billing_term_months,s.status AS subscription_status,s.current_period_end FROM media_tenants t JOIN media_plans p ON p.code=t.plan_code LEFT JOIN media_tenant_commercial_terms c ON c.tenant_id=t.id LEFT JOIN media_subscriptions s ON s.tenant_id=t.id WHERE t.status IN ('active','suspended')"
  ).all<any>();

  for(const tenant of tenants.results||[]){
    await ensureRenewalInvoice(env,tenant,terms as any[]);

    const now=Date.now();
    const periodEnd=tenant.current_period_end?new Date(String(tenant.current_period_end)).getTime():0;
    let subscriptionStatus=String(tenant.subscription_status||"pending");
    let accountStatus=String(tenant.status);

    if(subscriptionStatus==="active" && periodEnd>0 && periodEnd<=now){
      subscriptionStatus="past_due";
      await env.MEDIA_DB.prepare("UPDATE media_subscriptions SET status='past_due',updated_at=datetime('now') WHERE tenant_id=?").bind(String(tenant.id)).run();
    }

    const graceDays=Math.max(0,Number(enforcement.graceDays||0));
    const graceEnd=periodEnd+graceDays*24*60*60*1000;
    const paymentBlocked=subscriptionStatus==="past_due" && now>graceEnd;

    const usage=await env.MEDIA_DB.prepare(
      "SELECT COALESCE((SELECT SUM(size_bytes) FROM media_objects o JOIN media_buckets b ON b.id=o.bucket_id WHERE b.tenant_id=? AND o.status='ready'),0) AS storage_bytes,COALESCE((SELECT SUM(delivered_bytes) FROM media_usage_daily WHERE tenant_id=? AND usage_date>=date('now','start of month')),0) AS delivery_bytes,COALESCE((SELECT SUM(delivery_requests) FROM media_usage_daily WHERE tenant_id=? AND usage_date>=date('now','start of month')),0) AS delivery_requests"
    ).bind(String(tenant.id),String(tenant.id),String(tenant.id)).first<any>();

    const storageLimit=Number(tenant.custom_storage_bytes??tenant.storage_bytes);
    const deliveryLimit=Number(tenant.custom_delivery_bytes??tenant.delivery_bytes);
    const requestLimit=Number(tenant.custom_delivery_requests??tenant.delivery_requests);
    const usageBlocked=Number(usage?.storage_bytes||0)>=storageLimit || Number(usage?.delivery_bytes||0)>=deliveryLimit || Number(usage?.delivery_requests||0)>=requestLimit;

    const deliveryBlocked=usageBlocked || paymentBlocked || accountStatus==="suspended";
    await syncTenantRouteBlock(env,String(tenant.id),deliveryBlocked);

    if(paymentBlocked && Boolean(enforcement.suspendDeliveryAfterGrace) && accountStatus!=="suspended"){
      await env.MEDIA_DB.prepare("UPDATE media_tenants SET status='suspended' WHERE id=?").bind(String(tenant.id)).run();
      accountStatus="suspended";
    }
  }

  await env.MEDIA_DB.prepare("DELETE FROM media_quota_reservations WHERE committed_at IS NULL AND expires_at<datetime('now','-1 day')").run();
  await env.MEDIA_DB.prepare("DELETE FROM media_sessions WHERE expires_at<datetime('now','-7 days')").run();
}

export default {
  async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext){
    ctx.waitUntil((async()=>{
      try{await syncUsage(env);}catch(error){console.error("usage sync",error);}
      try{await enforce(env);}catch(error){console.error("enforcement",error);}
    })());
  },
  async fetch(_request:Request,env:Env){
    await syncUsage(env);
    await enforce(env);
    return new Response("ok");
  }
};
