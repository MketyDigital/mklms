'use client';

import Script from "next/script";
import { useState } from "react";

type FlutterwaveInlinePayload={
  publicKey:string;
  reference:string;
  amount:number;
  currency:string;
  email:string;
  customerName?:string;
  redirectPath:string;
  metadata:Record<string,unknown>;
  payloadHash:string;
};

declare global{
  interface Window{
    FlutterwaveCheckout?:(options:Record<string,unknown>)=>{close?:()=>void};
    Korapay?:{initialize:(options:Record<string,unknown>)=>void};
  }
}

const currencies=[
  ["USD","US Dollar"],["NGN","Nigerian Naira"],["GHS","Ghanaian Cedi"],["KES","Kenyan Shilling"],
  ["GBP","British Pound"],["EUR","Euro"],["ZAR","South African Rand"],["XAF","Central African CFA Franc"],
  ["XOF","West African CFA Franc"],["UGX","Ugandan Shilling"],["RWF","Rwandan Franc"],["TZS","Tanzanian Shilling"],
  ["MWK","Malawian Kwacha"],["EGP","Egyptian Pound"],
];

async function postForm(url:string,values:Record<string,string>){
  const body=new URLSearchParams(values);
  const response=await fetch(url,{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json"},
    body,
    credentials:"same-origin",
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload) throw new Error(payload?.error||"payment");
  return payload;
}

export default function PaymentMethodsClient({
  invoiceId,
  amountUsd,
  defaultEmail,
  nowPaymentsConfigured,
  flutterwaveConfigured,
  koraConfigured,
}:{
  invoiceId:string;
  amountUsd:number;
  defaultEmail:string;
  nowPaymentsConfigured:boolean;
  flutterwaveConfigured:boolean;
  koraConfigured:boolean;
}){
  const [email,setEmail]=useState(defaultEmail);
  const [currency,setCurrency]=useState("USD");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  const [nowWidget,setNowWidget]=useState<{widgetUrl:string;hostedUrl:string}|null>(null);
  const [fwReady,setFwReady]=useState(false);
  const [koraReady,setKoraReady]=useState(false);

  async function startNowPayments(){
    setBusy("now"); setMessage("Preparing secure crypto checkout…");
    try{
      const data=await postForm("/api/billing/nowpayments",{invoiceId,experience:"embedded"});
      setNowWidget({widgetUrl:String(data.widgetUrl),hostedUrl:String(data.hostedUrl)});
      setMessage("NOWPayments is ready below. Access activates only after Mkety verifies the signed payment notification.");
    }catch{
      setMessage("Could not prepare NOWPayments checkout. Please try again.");
    }finally{setBusy("");}
  }

  async function startFlutterwave(){
    if(!email){setMessage("Enter an email address for the payment receipt.");return;}
    if(!fwReady||!window.FlutterwaveCheckout){setMessage("Flutterwave checkout is still loading. Please try again.");return;}
    setBusy("flutterwave"); setMessage("Preparing secure Flutterwave checkout…");
    try{
      const data=await postForm("/api/billing/flutterwave",{invoiceId,email,currency});
      if(data.checkoutExperience==="inline"&&data.inline){
        const p=data.inline as FlutterwaveInlinePayload;
        setMessage("Opening Flutterwave securely over this page…");
        window.FlutterwaveCheckout({
          public_key:p.publicKey,
          tx_ref:p.reference,
          amount:p.amount,
          currency:p.currency,
          redirect_url:`${window.location.origin}${p.redirectPath}`,
          payload_hash:p.payloadHash,
          customer:{email:p.email,...(p.customerName?{name:p.customerName}:{})},
          meta:p.metadata,
          customizations:{title:"Mkety Media",description:"Secure Mkety Media payment"},
          onclose:()=>setMessage("Checkout closed. No plan or quota is activated until Mkety verifies payment."),
        });
      }else if(data.checkoutUrl){
        setMessage("Inline checkout is temporarily unavailable. Opening Flutterwave secure checkout…");
        window.location.assign(String(data.checkoutUrl));
      }else{
        throw new Error("inline");
      }
    }catch{
      setMessage("Could not prepare Flutterwave checkout. Please try again.");
    }finally{setBusy("");}
  }

  async function startKora(){
    if(!email){setMessage("Enter an email address for the payment receipt.");return;}
    if(!koraReady||!window.Korapay){setMessage("Kora checkout is still loading. Please try again.");return;}
    setBusy("kora"); setMessage("Preparing secure Kora checkout…");
    try{
      const p=await postForm("/api/billing/kora",{invoiceId,email});
      setMessage("Kora checkout is ready below.");
      window.Korapay.initialize({
        key:p.publicKey,
        reference:p.reference,
        amount:p.amount,
        currency:p.currency,
        customer:{name:p.customerName,email:p.email},
        notification_url:p.notificationUrl,
        narration:"Secure Mkety Media payment",
        metadata:p.metadata,
        merchant_bears_cost:true,
        containerId:"mkety-media-kora-checkout",
        onSuccess:()=>window.location.assign(p.redirectPath),
        onPending:()=>setMessage("Payment is pending. Mkety will verify it before activating access."),
        onFailed:()=>setMessage("The Kora payment was not completed. You can try again."),
        onClose:()=>setMessage("Checkout closed. No plan or quota is activated until Mkety verifies payment."),
      });
    }catch{
      setMessage("Could not prepare Kora checkout. Please try again.");
    }finally{setBusy("");}
  }

  return <>
    {flutterwaveConfigured&&<Script src="https://checkout.flutterwave.com/v3.js" strategy="afterInteractive" onLoad={()=>setFwReady(true)}/>}
    {koraConfigured&&<Script src="https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js" strategy="afterInteractive" onLoad={()=>setKoraReady(true)}/>}

    <div className="form" style={{marginTop:18}}>
      {(flutterwaveConfigured||koraConfigured)&&
        <label>Email for payment receipt
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
        </label>
      }

      <div className="toolbar" style={{alignItems:"flex-start"}}>
        {nowPaymentsConfigured&&<div style={{minWidth:220}}>
          <button type="button" className="btn secondary" disabled={busy==="now"} onClick={startNowPayments}>
            {busy==="now"?"Preparing…":"Pay with crypto"}
          </button>
          <p className="muted">NOWPayments widget · stays on Mkety Media</p>
        </div>}

        {flutterwaveConfigured&&<div style={{minWidth:270}}>
          <label>Flutterwave payment currency
            <select value={currency} onChange={e=>setCurrency(e.target.value)}>
              {currencies.map(([code,name])=><option key={code} value={code}>{code} — {name}</option>)}
            </select>
          </label>
          <button type="button" className="btn" disabled={busy==="flutterwave"||!fwReady} onClick={startFlutterwave}>
            {!fwReady?"Loading Flutterwave…":busy==="flutterwave"?"Preparing…":"Pay with Flutterwave"}
          </button>
          <p className="muted">Secure Flutterwave Inline opens over this page.</p>
        </div>}

        {koraConfigured&&<div style={{minWidth:220}}>
          <button type="button" className="btn secondary" disabled={busy==="kora"||!koraReady} onClick={startKora}>
            {!koraReady?"Loading Kora…":busy==="kora"?"Preparing…":"Pay with Kora"}
          </button>
          <p className="muted">Kora checkout embeds below.</p>
        </div>}
      </div>

      {message&&<div className="notice" style={{marginTop:12}}>{message}</div>}

      {nowWidget&&<div style={{marginTop:18}}>
        <iframe
          src={nowWidget.widgetUrl}
          title="NOWPayments secure cryptocurrency checkout"
          style={{width:"100%",height:720,border:0,borderRadius:16}}
          allow="clipboard-write; payment"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <p className="muted">If the widget does not load, <a href={nowWidget.hostedUrl} target="_blank" rel="noopener noreferrer">open NOWPayments securely</a>.</p>
      </div>}

      {koraConfigured&&<div id="mkety-media-kora-checkout" style={{margin:"18px auto 0",minHeight:0,maxWidth:440,overflow:"hidden",borderRadius:16}}/>}

      <p className="muted">Payment completion in a widget or modal does not activate service by itself. Mkety waits for provider webhook verification and server-side settlement.</p>
      <p className="muted">Mkety invoice value: USD {amountUsd.toFixed(2)}.</p>
    </div>
  </>;
}
