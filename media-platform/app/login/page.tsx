import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="wrap">
      <form className="card form" method="post" action="/api/auth/login">
        <h1>Login to Mkety Media</h1>
        <label>Username</label>
        <input name="username" autoComplete="username" required />
        <label>Password</label>
        <input type="password" name="password" autoComplete="current-password" required />
        <button className="btn" type="submit">Login</button>
        <p className="muted">New here? <Link href="/signup">Create an account</Link>.</p>
      </form>
    </main>
  );
}
