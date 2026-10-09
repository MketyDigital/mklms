"use client";

import { useState } from "react";

type RecoveryResult = { error?:string; username?:string; resetUrl?:string; expiresInMinutes?:number };

export default function OperatorRecoveryTool(){
  const [identifier,setIdentifier]=useState("");
  const [resetUrl,setResetUrl]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);

  async function issue(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);
    setResetUrl("");
    setStatus("");
    try{
      const body=new URLSearchParams({identifier});
      const response=await fetch("/api/operator/recovery",{
        method:"POST",
        headers:{"content-type":"application/x-www-form-urlencoded"},
        body,
      });
      const result=await response.json() as RecoveryResult;
      if(!response.ok) throw new Error(result.error||"Could not create a recovery link.");
      setResetUrl(String(result.resetUrl||""));
      setStatus("Link for "+String(result.username||"the customer")+" expires in 15 minutes. Send it privately after verifying account ownership.");
    }catch(error){
      setStatus(error instanceof Error?error.message:"Could not create a recovery link.");
    }finally{
      setBusy(false);
    }
  }

  async function copyLink(){
    try{
      await navigator.clipboard.writeText(resetUrl);
      setStatus("Recovery link copied. Send it privately after verifying account ownership.");
    }catch{
      setStatus("Copy was blocked by this browser. Select and copy the link below.");
    }
  }

  return <section className="card" style={{marginTop:18}}>
    <h2>Help a customer recover access</h2>
    <p className="muted">Use this when a customer has no Telegram recovery linked. Verify that the person owns the account before issuing a link. The customer chooses a new password; the link works once and expires in 15 minutes.</p>
    <form onSubmit={issue}>
      <label>Email or username<input value={identifier} onChange={event=>setIdentifier(event.target.value)} required autoComplete="off" maxLength={254}/></label>
      <button className="btn" type="submit" disabled={busy}>{busy?"Creating link…":"Create recovery link"}</button>
    </form>
    {status&&<p role="status" aria-live="polite" className="muted">{status}</p>}
    {resetUrl&&<div style={{marginTop:12}}>
      <label>One-time recovery link<textarea value={resetUrl} readOnly rows={3} style={{width:"100%"}}/></label>
      <button className="btn secondary" type="button" onClick={copyLink}>Copy recovery link</button>
    </div>}
  </section>;
}
