import { getMediaDb, getMediaEnv } from "../lib/postgres";

function addMonths(date:Date,months:number){
  const next=new Date(date);
  const day=next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth()+months);
  const maxDay=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
  next.setUTCDate(Math.min(day,maxDay));
  return next;
}

export async function settleInvoice(input:{
  invoiceId:string;
  provider:"nowpayments"|"bank_transfer"|"flutterwave"|"kora";
  paymentId:string;
  approvedBy?:string;
}){
  const db=getMediaDb();
  const invoice=await db.prepare(
    "SELECT i.id,i.tenant_id,i.status,c.billing_term_months,s.current_period_end,p.purchase_type,p.target_plan_code,p.addon_code FROM media_invoices i LEFT JOIN media_tenant_commercial_terms c ON c.tenant_id=i.tenant_id LEFT JOIN media_subscriptions s ON s.tenant_id=i.tenant_id LEFT JOIN media_purchases p ON p.invoice_id=i.id WHERE i.id=? LIMIT 1"
  ).bind(input.invoiceId).first<any>();

  if(!invoice) throw new Error("Invoice not found");
  if(invoice.status==="paid") return {ok:true,alreadyPaid:true};
  if(invoice.status!=="pending") throw new Error("Invoice is not payable");

  const purchaseType=String(invoice.purchase_type||"subscription");
  const legacyProvider=input.provider==="flutterwave"||input.provider==="kora"?"invoice":input.provider;
  const now=new Date();
  const nowIso=now.toISOString();
  const statements:any[]=[
    db.prepare("UPDATE media_invoices SET status='paid',payment_method=?,checkout_provider=?,provider_payment_id=?,paid_at=?,approved_by=?,updated_at=? WHERE id=? AND status='pending'")
      .bind(legacyProvider,input.provider,input.paymentId,nowIso,input.approvedBy||null,nowIso,input.invoiceId),
  ];

  let periodEnd:string|null=invoice.current_period_end?String(invoice.current_period_end):null;

  if(purchaseType==="plan_upgrade"){
    const targetPlan=String(invoice.target_plan_code||"");
    if(!targetPlan) throw new Error("Upgrade target is missing");
    statements.push(
      db.prepare("UPDATE media_tenants SET plan_code=?,status='active' WHERE id=?").bind(targetPlan,String(invoice.tenant_id)),
      db.prepare("UPDATE media_tenant_commercial_terms SET base_plan_code=?,display_name=NULL,monthly_usd=NULL,storage_bytes=NULL,delivery_bytes=NULL,delivery_requests=NULL,logical_buckets=NULL,team_seats=NULL,max_object_bytes=NULL,enterprise_features=0,infrastructure_mode='automatic',preferred_pool_key='r2-global',updated_at=datetime('now') WHERE tenant_id=?").bind(targetPlan,String(invoice.tenant_id)),
      db.prepare("UPDATE media_subscriptions SET status='active',payment_provider=?,checkout_provider=?,updated_at=? WHERE tenant_id=?").bind(legacyProvider,input.provider,nowIso,String(invoice.tenant_id)),
    );
  } else if(purchaseType==="addon"){
    const addonCode=String(invoice.addon_code||"");
    const addon=await db.prepare("SELECT * FROM media_addon_products WHERE code=? AND active=1 LIMIT 1").bind(addonCode).first<any>();
    if(!addon) throw new Error("Add-on product is unavailable");
    if(!periodEnd || new Date(periodEnd).getTime()<=Date.now()) throw new Error("Active paid period required for add-on");
    statements.push(
      db.prepare("INSERT INTO media_tenant_addons (id,tenant_id,product_code,storage_bytes,delivery_bytes,delivery_requests,starts_at,ends_at,invoice_id) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),String(invoice.tenant_id),addonCode,Number(addon.storage_bytes||0),Number(addon.delivery_bytes||0),Number(addon.delivery_requests||0),nowIso,periodEnd,input.invoiceId)
    );
  } else {
    const months=Number(invoice.billing_term_months||1);
    const existingEnd=invoice.current_period_end?new Date(String(invoice.current_period_end)):null;
    const base=existingEnd && existingEnd.getTime()>Date.now()?existingEnd:now;
    periodEnd=addMonths(base,months).toISOString();
    statements.push(
      db.prepare("UPDATE media_tenants SET status='active' WHERE id=?").bind(String(invoice.tenant_id)),
      db.prepare("UPDATE media_subscriptions SET status='active',payment_provider=?,checkout_provider=?,current_period_end=?,updated_at=? WHERE tenant_id=?")
        .bind(legacyProvider,input.provider,periodEnd,nowIso,String(invoice.tenant_id)),
    );
  }

  statements.push(
    db.prepare("INSERT INTO media_audit_log (id,tenant_id,actor_type,actor_id,action,target_type,target_id,metadata_json) VALUES (?,?,'payment',?,'invoice.settled','invoice',?,?)")
      .bind(crypto.randomUUID(),String(invoice.tenant_id),input.approvedBy||input.provider,input.invoiceId,JSON.stringify({provider:input.provider,paymentId:input.paymentId,purchaseType}))
  );

  await db.batch(statements);

  const env=getMediaEnv();
  if(env.BUCKET_DIRECTORY){
    const tenant=await db.prepare("SELECT slug FROM media_tenants WHERE id=? LIMIT 1").bind(String(invoice.tenant_id)).first<any>();
    const buckets=await db.prepare("SELECT id,slug,pool_key,prefix,cache_control FROM media_buckets WHERE tenant_id=?").bind(String(invoice.tenant_id)).all<any>();
    if(tenant){
      for(const bucket of buckets.results||[]){
        await env.BUCKET_DIRECTORY.put(String(tenant.slug)+"/"+String(bucket.slug),JSON.stringify({
          tenantId:String(invoice.tenant_id),
          bucketId:String(bucket.id),
          poolKey:String(bucket.pool_key),
          prefix:String(bucket.prefix),
          cacheControl:String(bucket.cache_control),
          deliveryBlocked:false,
        }));
      }
    }
  }

  return {ok:true,alreadyPaid:false,tenantId:String(invoice.tenant_id),periodEnd,purchaseType};
}
