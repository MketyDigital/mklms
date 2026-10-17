import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";

/** D1 session persistence slice; does not replace the full AccessRepository. */
export class D1StudentSessionStore {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }

  async create(studentId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    if (!studentId || !tokenHash || !Number.isFinite(expiresAt.getTime())) throw new Error("Invalid session input");
    await executeD1(this.db, {
      sql: "INSERT INTO student_sessions(id,student_id,token_hash,expires_at) VALUES(?,?,?,?)",
      params: [randomUUID(),studentId,tokenHash,expiresAt.toISOString()],
    });
  }

  async lookup(tokenHash: string, now: Date): Promise<{
    studentId: string; displayName: string; email: string | null; expiresAt: Date;
  } | null> {
    if (!tokenHash || !Number.isFinite(now.getTime())) throw new Error("Invalid session lookup");
    const rows = await queryD1Rows<{
      student_id: string; display_name: string; email: string | null; expires_at: string;
    }>(this.db, {
      sql: `SELECT ss.student_id,s.display_name,s.email,ss.expires_at
        FROM student_sessions ss JOIN students s ON s.id=ss.student_id
        WHERE ss.token_hash=? AND ss.revoked_at IS NULL AND ss.expires_at>?
          AND s.status='ACTIVE' LIMIT 1`,
      params: [tokenHash,now.toISOString()],
    });
    const row = rows[0];
    return row ? {studentId:row.student_id,displayName:row.display_name,email:row.email,expiresAt:new Date(row.expires_at)} : null;
  }

  async revoke(tokenHash: string): Promise<void> {
    if (!tokenHash) throw new Error("Session hash required");
    await executeD1(this.db, {
      sql: "UPDATE student_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=? AND revoked_at IS NULL",
      params:[tokenHash],
    });
  }
}
