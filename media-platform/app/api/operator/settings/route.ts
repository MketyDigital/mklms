import { NextResponse } from "next/server";
import { isOperator } from "../../../../src/auth/operator";
import { setSetting } from "../../../../src/lib/operator-settings";

export async function POST(request:Request){
  if(!(await isOperator())) return NextResponse.redirect(new URL("/operator/login",request.url),303);
  const form=await request.formData();
  const kind=String(form.get("kind")||"");

  if(kind==="billing_terms"){
    const terms=[
      {months:1,discountPercent:0,label:"Monthly"},
      {months:3,discountPercent:Number(form.get("discount3")||0),label:"3 months"},
      {months:6,discountPercent:Number(form.get("discount6")||0),label:"6 months"},
      {months:12,discountPercent:Number(form.get("discount12")||0),label:"12 months"},
    ].map((term)=>({...term,discountPercent:Math.max(0,Math.min(20,term.discountPercent))}));
    await setSetting("billing_terms",terms);
  }

  if(kind==="bank"){
    await setSetting("bank_transfer",{
      enabled:form.get("enabled")==="on",
      currency:String(form.get("currency")||"NGN").toUpperCase(),
      usdToLocalRate:Math.max(0,Number(form.get("usdToLocalRate")||0)),
      roundTo:Math.max(1,Number(form.get("roundTo")||1)),
      bankName:String(form.get("bankName")||""),
      accountName:String(form.get("accountName")||""),
      accountNumber:String(form.get("accountNumber")||""),
      paymentUrl:(()=>{const raw=String(form.get("paymentUrl")||"").trim();if(!raw)return "";try{const u=new URL(raw);return u.protocol==="https:"||u.protocol==="http:"?u.toString():"";}catch{return "";}})(),
      paymentProviderName:String(form.get("paymentProviderName")||"").trim(),
      paymentButtonText:String(form.get("paymentButtonText")||"Pay securely").trim()||"Pay securely",
      instructions:String(form.get("instructions")||""),
    });
  }

  if(kind==="portal"){
    await setSetting("portal_content",{
      heroTitle:String(form.get("heroTitle")||""),
      heroSubtitle:String(form.get("heroSubtitle")||""),
      enterpriseTitle:String(form.get("enterpriseTitle")||""),
      enterpriseText:String(form.get("enterpriseText")||""),
      maintenanceNotice:String(form.get("maintenanceNotice")||""),
      signupEnabled:form.get("signupEnabled")==="on",
      planBenefits:String(form.get("planBenefits")||"").split("\n").map((v)=>v.trim()).filter(Boolean),
    });
  }

  if(kind==="enforcement"){
    await setSetting("enforcement",{
      warning70:true,
      warning85:true,
      warning95:true,
      graceDays:Math.max(0,Math.min(30,Number(form.get("graceDays")||3))),
      suspendDeliveryAfterGrace:form.get("suspendDelivery")==="on",
    });
  }

  return NextResponse.redirect(new URL("/operator?saved=settings",request.url),303);
}
