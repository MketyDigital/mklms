export default function OperatorLogin(){
  return <main className="wrap"><form className="card form" method="post" action="/api/operator/login">
    <h1>Mkety Media Operator</h1>
    <label>Operator access key</label>
    <input type="password" name="accessKey" required autoComplete="current-password"/>
    <button className="btn">Login</button>
  </form></main>;
}
