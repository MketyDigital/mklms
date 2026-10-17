import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";

export interface D1CredentialInput {
  studentId: string; lookupHash: string; hash: string;
  salt: string; algorithm: string; prefix: string | null;
}
/** Low-level D1 credential store. Atomic replacement requires a batch/transaction
 * and is deliberately not exposed until its rollback behavior is verified. */
export class D1CredentialStore {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }
  async findActiveByLookupHash(lookupHash: string): Promise<{
    studentId: string; hash: string; salt: string; algorithm: string;
  } | null> {
    if (!lookupHash) throw new Error("Credential lookup hash required");
    const rows = await queryD1Rows<{
      student_id: string;credential_hash: string;credential_salt: string;credential_algorithm: string;
    }>(this.db,{
      sql: `SELECT c.student_id,c.credential_hash,c.credential_salt,c.credential_algorithm
        FROM student_access_credentials c JOIN students s ON s.id=c.student_id
        WHERE c.credential_lookup_hash=? AND c.status='ACTIVE'
          AND c.provider_type='access-code' AND s.status='ACTIVE' LIMIT 1`,
      params:[lookupHash],
    });
    const row=rows[0];
    return row?{studentId:row.student_id,hash:row.credential_hash,salt:row.credential_salt,algorithm:row.credential_algorithm}:null;
  }
  /** D1 batch is one atomic transaction: either revocation and insert both commit,
   * or neither does. Never split these calls into separate requests.
   */
  async rotate(input: D1CredentialInput): Promise<void> {
    if (![input.studentId,input.lookupHash,input.hash,input.salt,input.algorithm].every(Boolean))
      throw new Error("Incomplete credential input");
    const statements = [
      this.db.prepare(`UPDATE student_access_credentials
        SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE student_id=? AND provider_type='access-code' AND status='ACTIVE'`).bind(input.studentId),
      this.db.prepare(`INSERT INTO student_access_credentials
        (id,student_id,provider_type,credential_lookup_hash,credential_hash,
        credential_salt,credential_algorithm,credential_prefix,status)
        VALUES(?,?,'access-code',?,?,?,?,?,'ACTIVE')`).bind(
          randomUUID(),input.studentId,input.lookupHash,input.hash,input.salt,input.algorithm,input.prefix,
        ),
    ];
    const result=await this.db.batch(statements);
    if (!Array.isArray(result) || result.length !== 2 ||
      result.some(item => !item || typeof item !== "object" || !("success" in item) || item.success !== true))
      throw new Error("D1 credential rotation transaction did not complete");
  }
  async insertInitial(input: D1CredentialInput): Promise<void> {
    if (![input.studentId,input.lookupHash,input.hash,input.salt,input.algorithm].every(Boolean))
      throw new Error("Incomplete credential input");
    await executeD1(this.db,{
      sql: `INSERT INTO student_access_credentials
        (id,student_id,provider_type,credential_lookup_hash,credential_hash,
        credential_salt,credential_algorithm,credential_prefix,status)
        VALUES(?,?,'access-code',?,?,?, ?,?,'ACTIVE')`,
      params:[randomUUID(),input.studentId,input.lookupHash,input.hash,input.salt,input.algorithm,input.prefix],
    });
  }
}
