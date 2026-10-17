import { randomUUID } from "node:crypto";
import type { ClaimVerificationStrategy } from "../domain/claim-verification";
import { normalizeIdentity } from "../domain/preauthorization.ts";
import type { AccessCodeHash, PreauthorizationRecord } from "../types";
import type {
  AdminAccessRepository, AdminStudentSummary, CreatePreauthorizationInput, CreatePreauthorizationResult,
  StudentAccessStatus, UpdatePendingPreauthorizationInput,
} from "./admin-access.repository";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";

type D1Statement = ReturnType<D1DatabaseLike["prepare"]>;
type PreauthRow = {
  id: string; email: string | null; phone: string | null; name_hint: string | null; course_id: string | null;
  status: PreauthorizationRecord["status"]; claim_strategy: NonNullable<PreauthorizationRecord["claimStrategy"]>;
  claim_code_hash: string | null; claim_requested_at: string | null; manual_approved_at: string | null;
};

function mapPreauthorization(row: PreauthRow): PreauthorizationRecord {
  return { id: row.id, email: row.email, phone: row.phone, nameHint: row.name_hint, courseId: row.course_id,
    status: row.status, claimStrategy: row.claim_strategy, claimCodeHash: row.claim_code_hash,
    claimRequestedAt: row.claim_requested_at ? new Date(row.claim_requested_at) : null,
    manualApprovedAt: row.manual_approved_at ? new Date(row.manual_approved_at) : null };
}

async function atomicBatch(db: D1DatabaseLike, statements: D1Statement[]): Promise<void> {
  const result = await db.batch(statements);
  if (!Array.isArray(result) || result.length !== statements.length ||
    result.some((item) => !item || typeof item !== "object" || !("success" in item) || item.success !== true)) {
    throw new Error("D1 admin access transaction did not complete");
  }
}

export class D1AdminAccessRepository implements AdminAccessRepository {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }

  async createPreauthorization(input: CreatePreauthorizationInput): Promise<CreatePreauthorizationResult> {
    const email = input.email ? normalizeIdentity(input.email, "email") : null;
    const phone = input.phone ? normalizeIdentity(input.phone, "phone") : null;
    const courseId = input.courseId ?? null;
    const existing = await this.findExistingPreauthorization(email, phone, courseId);
    if (existing) return { created: false, record: mapPreauthorization(existing) };
    const id = randomUUID();
    try {
      await executeD1(this.db, { sql: `INSERT INTO preauthorizations
        (id,email,phone,name_hint,course_id,claim_strategy,claim_code_hash,source,external_reference)
        VALUES(?,?,?,?,?,?,?,?,?)`,
        params: [id, email, phone, input.nameHint ?? null, courseId, input.claimStrategy,
          input.claimCodeHash ?? null, input.source, input.externalReference ?? null] });
    } catch (error) {
      const concurrent = await this.findExistingPreauthorization(email, phone, courseId);
      if (concurrent) return { created: false, record: mapPreauthorization(concurrent) };
      throw error;
    }
    const rows = await queryD1Rows<PreauthRow>(this.db, { sql: `SELECT id,email,phone,name_hint,course_id,status,claim_strategy,
      claim_code_hash,claim_requested_at,manual_approved_at FROM preauthorizations WHERE id=?`, params: [id] });
    if (!rows[0]) throw new Error("Preauthorization was not persisted.");
    return { created: true, record: mapPreauthorization(rows[0]) };
  }

  private async findExistingPreauthorization(email: string | null, phone: string | null, courseId: string | null): Promise<PreauthRow | null> {
    const rows = await queryD1Rows<PreauthRow>(this.db, { sql: `SELECT id,email,phone,name_hint,course_id,status,claim_strategy,
      claim_code_hash,claim_requested_at,manual_approved_at FROM preauthorizations
      WHERE status IN ('PREAUTHORIZED','CLAIMED') AND COALESCE(course_id,'')=COALESCE(?,'')
        AND ((? IS NOT NULL AND LOWER(email)=?) OR (? IS NOT NULL AND phone=?))
      ORDER BY created_at DESC LIMIT 1`, params: [courseId,email,email,phone,phone] });
    return rows[0] ?? null;
  }

  async listPreauthorizations(limit = 100): Promise<PreauthorizationRecord[]> {
    const rows = await queryD1Rows<PreauthRow>(this.db, { sql: `SELECT id,email,phone,name_hint,course_id,status,claim_strategy,
      claim_code_hash,claim_requested_at,manual_approved_at FROM preauthorizations ORDER BY created_at DESC LIMIT ?`, params: [limit] });
    return rows.map(mapPreauthorization);
  }

  async updatePendingPreauthorization(id: string, input: UpdatePendingPreauthorizationInput): Promise<void> {
    const changes = await executeD1(this.db, { sql: `UPDATE preauthorizations SET name_hint=?,course_id=?,claim_strategy=?,
      claim_code_hash=?,claim_requested_at=NULL,manual_approved_at=NULL,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='PREAUTHORIZED'`, params: [input.nameHint ?? null,input.courseId ?? null,input.claimStrategy,
      input.claimCodeHash ?? null,id] });
    if (changes !== 1) throw new Error("Only an unclaimed pre-authorization can be edited.");
  }

  async cancelPendingPreauthorization(id: string): Promise<void> {
    const changes = await executeD1(this.db, { sql: "DELETE FROM preauthorizations WHERE id=? AND status='PREAUTHORIZED'", params: [id] });
    if (changes !== 1) throw new Error("Only an unclaimed pre-authorization can be cancelled.");
  }

  async approveManualClaim(id: string): Promise<void> {
    const changes = await executeD1(this.db, { sql: `UPDATE preauthorizations SET manual_approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='PREAUTHORIZED' AND claim_strategy='manual-approval' AND claim_requested_at IS NOT NULL`, params: [id] });
    if (changes !== 1) throw new Error("This manual claim request is not available for approval.");
  }

  async listStudents(limit = 100): Promise<AdminStudentSummary[]> {
    const rows = await queryD1Rows<{ id: string; display_name: string; email: string | null; phone: string | null; status: StudentAccessStatus; created_at: string }>(this.db, {
      sql: 'SELECT id,display_name,email,phone,status,created_at FROM students ORDER BY created_at DESC LIMIT ?', params: [limit],
    });
    return rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, phone: row.phone,
      status: row.status, createdAt: new Date(row.created_at) }));
  }

  async replaceAccessCredential(studentId: string, credential: { hash: AccessCodeHash; lookupHash: string; prefix: string }): Promise<void> {
    await atomicBatch(this.db, [
      this.db.prepare(`UPDATE student_access_credentials SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE student_id=? AND provider_type='access-code' AND status='ACTIVE'`).bind(studentId),
      this.db.prepare(`INSERT INTO student_access_credentials(id,student_id,provider_type,credential_lookup_hash,credential_hash,
        credential_salt,credential_algorithm,credential_prefix,status) VALUES(?,?,'access-code',?,?,?,?,?,'ACTIVE')`)
        .bind(randomUUID(),studentId,credential.lookupHash,credential.hash.hash,credential.hash.salt,credential.hash.algorithm,credential.prefix),
    ]);
  }

  async prepareStudentReclaim(studentId: string, input: { claimStrategy: ClaimVerificationStrategy; claimCodeHash?: string | null }): Promise<void> {
    const guardId = randomUUID();
    await atomicBatch(this.db, [
      this.db.prepare(`INSERT INTO mklms_d1_atomic_assertions(id,passed)
        SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM students s JOIN preauthorizations p ON p.claimed_by_student_id=s.id
          WHERE s.id=? AND p.status='CLAIMED') THEN 1 ELSE 0 END`).bind(guardId,studentId),
      this.db.prepare("UPDATE students SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(studentId),
      this.db.prepare("UPDATE student_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE student_id=? AND revoked_at IS NULL").bind(studentId),
      this.db.prepare(`UPDATE student_access_credentials SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE student_id=? AND provider_type='access-code' AND status='ACTIVE'`).bind(studentId),
      this.db.prepare(`UPDATE preauthorizations SET status='PREAUTHORIZED',claimed_by_student_id=NULL,claim_strategy=?,claim_code_hash=?,
        claim_requested_at=NULL,manual_approved_at=NULL,source='admin-reclaim',updated_at=CURRENT_TIMESTAMP
        WHERE id=(SELECT id FROM preauthorizations WHERE claimed_by_student_id=? AND status='CLAIMED'
          ORDER BY updated_at DESC,created_at DESC LIMIT 1) AND status='CLAIMED'`).bind(input.claimStrategy,input.claimCodeHash ?? null,studentId),
      this.db.prepare('DELETE FROM mklms_d1_atomic_assertions WHERE id=?').bind(guardId),
    ]);
  }

  async setStudentStatus(studentId: string, status: StudentAccessStatus): Promise<void> {
    const statements: D1Statement[] = [this.db.prepare('UPDATE students SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,studentId)];
    if (status !== "ACTIVE") {
      statements.push(this.db.prepare('UPDATE student_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE student_id=? AND revoked_at IS NULL').bind(studentId));
    }
    await atomicBatch(this.db, statements);
  }
}
