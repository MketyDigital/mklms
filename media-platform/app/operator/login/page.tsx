export default function OperatorLogin(){
  return <main className="wrap"><form className="card form" method="post" action="/api/operator/login">
    <h1>Mkety Media Operator</h1>
    <p className="muted">Internal Mkety administration only. Use the operator access key configured in the production secret <strong>MEDIA_OPERATOR_ACCESS_KEY</strong> (or the configured Mkety admin fallback key).</p>
    <label>Operator access key</label>
    <input type="password" name="accessKey" required autoComplete="current-password"/>
    <button className="btn">Login</button>
    <p className="muted">Customer usernames/passwords do not work here. Customer login is at /login.</p>
  </form></main>;
}
