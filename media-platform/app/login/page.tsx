import type { Metadata } from "next";
import Link from "next/link";

export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

export default async function LoginPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const params=await searchParams;
  return (
    <main className="wrap">
      <form className="card form" method="post" action="/api/auth/login"><div className="auth-brand" aria-label="Mkety"></div>
        <h1>Welcome back</h1>
        {params.notice==="existing"&&<div className="notice">You already have an account with this email. Sign in to continue where you left off.</div>}
        {params.error==="1"&&<div className="notice danger">That email/username or password is incorrect.</div>}
        {params.error==="rate"&&<div className="notice danger">Too many sign-in attempts. Please try again shortly.</div>}
        <label>Email or username</label>
        <input name="username" autoComplete="username" defaultValue={params.email||""} required />
        <label>Password</label>
        <input type="password" name="password" autoComplete="current-password" required />
        <button className="btn" type="submit">Login</button>
        {params.reset==="1"&&<div className="notice">Password updated. Sign in with your new password.</div>}
        <p className="muted"><Link href="/forgot-password">Forgot password or lost access?</Link></p>
        <p className="muted">New to Mkety Media? <Link href="/signup">Create an account</Link>.</p>
      </form>
    </main>
  );
}
