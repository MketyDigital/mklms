import type { Metadata } from "next";
import Link from "next/link";
import { getMediaEnv } from "../../src/lib/postgres";

export const dynamic="force-dynamic";
export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const params=await searchParams;
  const env=getMediaEnv() as any;
  const telegramReady=Boolean(env.MEDIA_TELEGRAM_BOT_TOKEN&&env.MEDIA_TELEGRAM_BOT_USERNAME);
  return <main className="wrap"><div className="card form">
    <div className="auth-brand" aria-label="Mkety"></div>
    <h1>Recover your account</h1>
    <p className="muted">Enter the email or username on your Mkety Media account.</p>
    {params.status==="sent"&&<div className="notice">If Telegram recovery is linked to this account, continue with the recovery button shown on the next step.</div>}
    {params.error==="rate"&&<div className="notice danger">Too many recovery attempts. Please try again shortly.</div>}
    {!telegramReady&&<div className="notice">Account recovery is temporarily handled by Mkety Support.</div>}
    <form method="post" action="/api/auth/recovery/start">
      <label>Email or username</label>
      <input name="identifier" required autoComplete="username"/>
      <button className="btn" type="submit">Continue</button>
    </form>
    <p className="muted"><Link href="/login">Back to sign in</Link></p>
  </div></main>;
}
