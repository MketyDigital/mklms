import { cookies } from "next/headers";
import { getMediaDb } from "./postgres";
import { sessionTokenHash } from "../auth/session";

export type CurrentUser = {
  userId: string;
  username: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: string;
  role: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get("mkety_media_session")?.value;
  if (!token) return null;

  const tokenHash = await sessionTokenHash(token);
  const row = await getMediaDb().prepare(
    "SELECT u.id AS user_id,u.username,u.email,t.id AS tenant_id,t.slug AS tenant_slug,t.name AS tenant_name,t.status AS tenant_status,m.role FROM media_sessions s JOIN media_users u ON u.id=s.user_id JOIN media_memberships m ON m.user_id=u.id JOIN media_tenants t ON t.id=m.tenant_id WHERE s.token_hash=? AND s.expires_at>datetime('now') ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END LIMIT 1"
  ).bind(tokenHash).first<any>();

  if (!row) return null;
  return {
    userId: String(row.user_id),
    username: String(row.username),
    email: String(row.email||""),
    tenantId: String(row.tenant_id),
    tenantSlug: String(row.tenant_slug),
    tenantName: String(row.tenant_name),
    tenantStatus: String(row.tenant_status),
    role: String(row.role),
  };
}
