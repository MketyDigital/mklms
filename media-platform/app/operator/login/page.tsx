import type { Metadata } from "next";
export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

export default function OperatorLogin(){
  return <main className="wrap"><form className="card form" method="post" action="/api/operator/login">
    <div className="auth-brand" aria-label="Mkety"></div>
    <h1>Operator Login</h1>
    <label>Access key</label>
    <input type="password" name="accessKey" required autoComplete="current-password"/>
    <button className="btn">Login</button>
  </form></main>;
}
