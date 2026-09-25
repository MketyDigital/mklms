import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="wrap">
      <form className="card form" method="post" action="/api/auth/login"><div className="auth-brand" aria-label="Mkety"></div>
        <h1>Welcome back</h1>
        <label>Username</label>
        <input name="username" autoComplete="username" required />
        <label>Password</label>
        <input type="password" name="password" autoComplete="current-password" required />
        <button className="btn" type="submit">Login</button>
        <p className="muted">New to Mkety Media? <Link href="/signup">Create an account</Link>.</p>
      </form>
    </main>
  );
}
