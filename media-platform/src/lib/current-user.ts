import { cookies } from "next/headers";
import { getMediaDb } from "./postgres";
import { sessionTokenHash } from "../auth/session";

export type CurrentUser = {
  userId: string;
  username: string;
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
  const db = getMediaDb();
  const result = await db.query(
    "SELECT u.id AS user_id, u.username, t.id AS tenant_id, t.slug AS tenant_slug, t.name AS tenant_name, t.status AS tenant_status, m.role FROM media_sessions s JOIN media_users u ON u.id = s.user_id JOIN media_memberships m ON m.user_id = u.id JOIN media_tenants t ON t.id = m.tenant_id WHERE s.token_hash = $1 AND s.expires_at > now() ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END LIMIT 1",
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    userId: row.user_id,
    username: row.username,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    tenantStatus: row.tenant_status,
    role: row.role,
  };
}
