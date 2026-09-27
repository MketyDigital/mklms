import type { Metadata } from "next";
import Link from "next/link";

export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const params=await searchParams;
  const token=String(params.token||"");
  return <main className="wrap"><div className="card form">
    <div className="auth-brand" aria-label="Mkety"></div>
    <h1>Set a new password</h1>
    {params.error==="expired"&&<div className="notice danger">This recovery link has expired or was already used. Request a new one.</div>}
    {params.error==="invalid"&&<div className="notice danger">Use matching passwords with at least 10 characters.</div>}
    {params.error==="rate"&&<div className="notice danger">Too many attempts. Please try again shortly.</div>}
    {token?<form method="post" action="/api/auth/recovery/reset">
      <input type="hidden" name="token" value={token}/>
      <label>New password</label><input type="password" name="password" minLength={10} required autoComplete="new-password"/>
      <label>Confirm new password</label><input type="password" name="confirm" minLength={10} required autoComplete="new-password"/>
      <button className="btn" type="submit">Update password</button>
    </form>:<p className="muted">This recovery link is incomplete. <Link href="/forgot-password">Request a new recovery link</Link>.</p>}
  </div></main>;
}
