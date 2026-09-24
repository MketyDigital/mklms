import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../src/lib/current-user";
import { getTenantState } from "../../src/lib/tenant-state";
import { getMediaDb } from "../../src/lib/postgres";

export default async function TeamPage(){
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  if(!["owner","admin"].includes(user.role)) redirect("/dashboard");

  const state=await getTenantState(user.tenantId);
  const members=await getMediaDb().prepare(
    "SELECT u.id,u.username,u.status,m.role,m.created_at FROM media_memberships m JOIN media_users u ON u.id=m.user_id WHERE m.tenant_id=? ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,u.username"
  ).bind(user.tenantId).all<any>();

  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/dashboard">Dashboard</Link></div></nav>
    <h1>Team</h1><p className="muted">{(members.results||[]).length} of {state.teamSeats} seats used</p>
    {(members.results||[]).length<state.teamSeats && <form className="card" method="post" action="/api/team">
      <h2>Add member</h2>
      <label>Username<input name="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]+"/></label>
      <label>Temporary password<input type="password" name="password" required minLength={10}/></label>
      <label>Role<select name="role" defaultValue="member"><option value="member">Member</option><option value="admin">Admin</option><option value="billing">Billing</option></select></label>
      <button className="btn">Add member</button>
      <p className="muted">Share the username and temporary password securely with the team member.</p>
    </form>}
    <div className="card" style={{marginTop:18}}><table className="table"><thead><tr><th>Username</th><th>Role</th><th></th></tr></thead><tbody>
      {(members.results||[]).map((m:any)=><tr key={m.id}><td>{m.username}</td><td>{m.role}</td><td>{m.role!=="owner"&&<form method="post" action="/api/team/remove"><input type="hidden" name="userId" value={m.id}/><button className="btn secondary">Remove</button></form>}</td></tr>)}
    </tbody></table></div>
  </main>;
}
