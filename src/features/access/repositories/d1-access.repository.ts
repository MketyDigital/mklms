import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";
import type {
  AccessRepository,
  ActiveCredentialRecord,
  ActiveSessionRecord,
  CompleteVerifiedClaimRepositoryInput,
  CreateSessionInput,
  CreateStudentInput,
  StudentRecord,
} from "./access.repository";
import type { AccessCodeHash, ClaimIdentityInput, PreauthorizationRecord } from "../types";

type StudentRow = {
  id: string; display_name: string; email: string | null; phone: string | null;
  status: string; certificate_name: string; certificate_email: string | null;
};

function normalizeEmail(value?: string | null): string | null { return value?.trim().toLowerCase() || null; }
function normalizePhone(value?: string | null): string | null { return value?.replace(/\D/g, "") || null; }
function toStudent(row: StudentRow): StudentRecord {
  return { id: row.id, displayName: row.display_name, email: row.email, phone: row.phone,
    certificateName: row.certificate_name, certificateEmail: row.certificate_email };
}

async function runAtomicBatch(db: D1DatabaseLike, statements: ReturnType<D1DatabaseLike["prepare"]>[]): Promise<void> {
  const result = await db.batch(statements);
  if (!Array.isArray(result) || result.length !== statements.length ||
    result.some((item) => !item || typeof item !== "object" || !("success" in item) || item.success !== true)) {
    throw new Error("D1 atomic operation did not complete");
  }
}

/** Complete SQLite implementation of the access repository contract. */
export class D1AccessRepository implements AccessRepository {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }

  async findPreauthorization(identity: ClaimIdentityInput): Promise<PreauthorizationRecord | null> {
    const email = normalizeEmail(identity.email);
    const phone = normalizePhone(identity.phone);
    if (!email && !phone) return null;
    const rows = await queryD1Rows<{
      id: string; email: string | null; phone: string | null; name_hint: string | null; course_id: string | null;
      status: PreauthorizationRecord["status"]; claim_strategy: NonNullable<PreauthorizationRecord["claimStrategy"]>;
      claim_code_hash: string | null; claim_requested_at: string | null; manual_approved_at: string | null;
    }>(this.db, {
      sql: `SELECT id,email,phone,name_hint,course_id,status,claim_strategy,claim_code_hash,claim_requested_at,manual_approved_at
        FROM preauthorizations WHERE status='PREAUTHORIZED'
          AND ((? IS NOT NULL AND LOWER(email)=?) OR (? IS NOT NULL AND phone=?))
        ORDER BY created_at ASC LIMIT 1`,
      params: [email, email, phone, phone],
    });
    const row = rows[0];
    return row ? {
      id: row.id, email: row.email, phone: row.phone, nameHint: row.name_hint, courseId: row.course_id,
      status: row.status, claimStrategy: row.claim_strategy, claimCodeHash: row.claim_code_hash,
      claimRequestedAt: row.claim_requested_at ? new Date(row.claim_requested_at) : null,
      manualApprovedAt: row.manual_approved_at ? new Date(row.manual_approved_at) : null,
    } : null;
  }

  async markPreauthorizationClaimRequested(preauthorizationId: string): Promise<void> {
    await executeD1(this.db, { sql: `UPDATE preauthorizations
      SET claim_requested_at=COALESCE(claim_requested_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='PREAUTHORIZED'`, params: [preauthorizationId] });
  }

  async createStudent(input: CreateStudentInput): Promise<StudentRecord> {
    const id = randomUUID();
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    const certificateEmail = normalizeEmail(input.certificateEmail);
    await executeD1(this.db, { sql: `INSERT INTO students(id,display_name,email,phone,certificate_name,certificate_email,certificate_identity_locked_at)
      VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)`, params: [id, input.displayName, email, phone, input.certificateName, certificateEmail] });
    return { id, displayName: input.displayName, email, phone, certificateName: input.certificateName, certificateEmail };
  }

  async markPreauthorizationClaimed(preauthorizationId: string, studentId: string): Promise<void> {
    await executeD1(this.db, { sql: `UPDATE preauthorizations SET status='CLAIMED',claimed_by_student_id=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='PREAUTHORIZED'`, params: [studentId, preauthorizationId] });
  }

  async replaceAccessCredential(studentId: string, credential: { hash: AccessCodeHash; lookupHash: string; prefix: string }): Promise<void> {
    await runAtomicBatch(this.db, [
      this.db.prepare(`UPDATE student_access_credentials SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE student_id=? AND provider_type='access-code' AND status='ACTIVE'`).bind(studentId),
      this.credentialInsert(studentId, credential),
    ]);
  }

  async activateEnrollment(studentId: string, courseId: string): Promise<void> {
    await executeD1(this.db, { sql: `INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
      VALUES(?,?,?,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT(student_id,course_id) DO UPDATE SET
        status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
        activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
        updated_at=CURRENT_TIMESTAMP`, params: [randomUUID(), studentId, courseId] });
  }

  async completeVerifiedClaim(input: CompleteVerifiedClaimRepositoryInput): Promise<StudentRecord> {
    const email = normalizeEmail(input.student.email);
    const phone = normalizePhone(input.student.phone);
    const existing = await this.findStudentByIdentity(email, phone);
    if (existing && existing.status !== "ACTIVE") throw new Error("Existing student access is not active.");
    try {
      return await this.completeClaimBatch(input, email, phone, existing);
    } catch (error) {
      // A different preauthorization can claim the same email between our identity
      // read and D1 batch. Re-read once and retry against the winning student row.
      const claimState = await queryD1Rows<{ status: string }>(this.db, {
        sql: 'SELECT status FROM preauthorizations WHERE id=? LIMIT 1', params: [input.preauthorizationId],
      });
      if (!existing && claimState[0]?.status === "PREAUTHORIZED") {
        const raced = await this.findStudentByIdentity(email, phone);
        if (raced?.status === "ACTIVE") return this.completeClaimBatch(input, email, phone, raced);
      }
      throw error;
    }
  }

  private async completeClaimBatch(
    input: CompleteVerifiedClaimRepositoryInput, email: string | null, phone: string | null, existing: StudentRow | null,
  ): Promise<StudentRecord> {
    const studentId = existing?.id ?? randomUUID();
    const certificateEmail = normalizeEmail(input.student.certificateEmail);
    const statements = [];
    if (!existing) {
      statements.push(this.db.prepare(`INSERT INTO students
        (id,display_name,email,phone,certificate_name,certificate_email,certificate_identity_locked_at)
        SELECT ?,?,?,?,?,?,CURRENT_TIMESTAMP
        WHERE EXISTS(SELECT 1 FROM preauthorizations WHERE id=? AND status='PREAUTHORIZED')
          AND NOT EXISTS(SELECT 1 FROM students WHERE (? IS NOT NULL AND LOWER(email)=?) OR (? IS NOT NULL AND phone=?))`)
        .bind(studentId, input.student.displayName, email, phone, input.student.certificateName, certificateEmail,
          input.preauthorizationId, email, email, phone, phone));
    }
    statements.push(this.db.prepare(`UPDATE student_access_credentials SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      WHERE student_id=? AND provider_type='access-code' AND status='ACTIVE'
        AND EXISTS(SELECT 1 FROM preauthorizations WHERE id=? AND status='PREAUTHORIZED')`)
      .bind(studentId, input.preauthorizationId));
    statements.push(this.credentialInsert(studentId, input.credential, input.preauthorizationId));
    if (input.courseId) statements.push(this.courseEnrollmentStatement(studentId, input.courseId, input.preauthorizationId));
    statements.push(this.db.prepare(`UPDATE preauthorizations SET status='CLAIMED',claimed_by_student_id=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='PREAUTHORIZED'
        AND EXISTS(SELECT 1 FROM student_access_credentials WHERE student_id=? AND credential_lookup_hash=? AND status='ACTIVE')`)
      .bind(studentId, input.preauthorizationId, studentId, input.credential.lookupHash));
    const assertionId = randomUUID();
    statements.push(this.db.prepare(`INSERT INTO mklms_d1_atomic_assertions(id,passed)
      VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM preauthorizations WHERE id=? AND status='CLAIMED' AND claimed_by_student_id=?)
        AND EXISTS(SELECT 1 FROM student_access_credentials WHERE student_id=? AND credential_lookup_hash=? AND status='ACTIVE')
        THEN 1 ELSE 0 END)`).bind(assertionId, input.preauthorizationId, studentId, studentId, input.credential.lookupHash));
    statements.push(this.db.prepare('DELETE FROM mklms_d1_atomic_assertions WHERE id=?').bind(assertionId));
    await runAtomicBatch(this.db, statements);
    const rows = await queryD1Rows<StudentRow>(this.db, { sql: `SELECT id,display_name,email,phone,status,certificate_name,certificate_email
      FROM students WHERE id=? AND status='ACTIVE' LIMIT 1`, params: [studentId] });
    if (!rows[0]) throw new Error("Student claim did not produce an active student.");
    return toStudent(rows[0]);
  }

  private async findStudentByIdentity(email: string | null, phone: string | null): Promise<StudentRow | null> {
    if (!email && !phone) return null;
    const rows = await queryD1Rows<StudentRow>(this.db, { sql: `SELECT id,display_name,email,phone,status,certificate_name,certificate_email
      FROM students WHERE (? IS NOT NULL AND LOWER(email)=?) OR (? IS NOT NULL AND phone=?)
      ORDER BY created_at ASC LIMIT 1`, params: [email, email, phone, phone] });
    return rows[0] ?? null;
  }

  private credentialInsert(studentId: string, credential: { hash: AccessCodeHash; lookupHash: string; prefix: string }, preauthorizationId?: string) {
    const condition = preauthorizationId
      ? ` AND EXISTS(SELECT 1 FROM preauthorizations WHERE id=? AND status='PREAUTHORIZED')`
      : '';
    const params: (string | null)[] = [randomUUID(), studentId, credential.lookupHash, credential.hash.hash,
      credential.hash.salt, credential.hash.algorithm, credential.prefix];
    if (preauthorizationId) params.push(preauthorizationId);
    return this.db.prepare(`INSERT INTO student_access_credentials
      (id,student_id,provider_type,credential_lookup_hash,credential_hash,credential_salt,credential_algorithm,credential_prefix,status)
      SELECT ?,?,'access-code',?,?,?,?,?,'ACTIVE' WHERE EXISTS(SELECT 1 FROM students WHERE id=? AND status='ACTIVE')${condition}`)
      .bind(...params.slice(0, 2), ...params.slice(2, 7), studentId, ...(preauthorizationId ? [preauthorizationId] : []));
  }

  private courseEnrollmentStatement(studentId: string, courseId: string, preauthorizationId: string) {
    const enrollmentId = randomUUID();
    return this.db.prepare(`INSERT INTO enrollments(id,student_id,course_id,status,authorized_at,activated_at)
      SELECT ?,s.id,?,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      FROM students s WHERE s.id=? AND s.status='ACTIVE'
        AND EXISTS(SELECT 1 FROM preauthorizations WHERE id=? AND status='PREAUTHORIZED')
      ON CONFLICT(student_id,course_id) DO UPDATE SET
        status=CASE WHEN enrollments.status='COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
        activated_at=CASE WHEN enrollments.status='COMPLETED' THEN enrollments.activated_at ELSE CURRENT_TIMESTAMP END,
        updated_at=CURRENT_TIMESTAMP`).bind(enrollmentId, courseId, studentId, preauthorizationId);
  }

  async findActiveCredentialByLookupHash(lookupHash: string): Promise<ActiveCredentialRecord | null> {
    const rows = await queryD1Rows<{ student_id: string; credential_hash: string; credential_salt: string; credential_algorithm: "scrypt" }>(this.db, {
      sql: `SELECT student_id,credential_hash,credential_salt,credential_algorithm FROM student_access_credentials
        WHERE credential_lookup_hash=? AND provider_type='access-code' AND status='ACTIVE' LIMIT 1`, params: [lookupHash],
    });
    const row = rows[0];
    return row ? { studentId: row.student_id, status: "ACTIVE", hash: { hash: row.credential_hash, salt: row.credential_salt, algorithm: row.credential_algorithm } } : null;
  }

  async createSession(studentId: string, input: CreateSessionInput): Promise<void> {
    await executeD1(this.db, { sql: 'INSERT INTO student_sessions(id,student_id,token_hash,expires_at) VALUES(?,?,?,?)',
      params: [randomUUID(), studentId, input.tokenHash, input.expiresAt.toISOString()] });
  }

  async findActiveSessionByTokenHash(tokenHash: string, now: Date): Promise<ActiveSessionRecord | null> {
    const rows = await queryD1Rows<{ student_id: string; display_name: string; email: string | null; expires_at: string }>(this.db, {
      sql: `SELECT ss.student_id,s.display_name,s.email,ss.expires_at FROM student_sessions ss JOIN students s ON s.id=ss.student_id
        WHERE ss.token_hash=? AND ss.revoked_at IS NULL AND ss.expires_at>? AND s.status='ACTIVE' LIMIT 1`,
      params: [tokenHash, now.toISOString()],
    });
    const row = rows[0];
    if (!row) return null;
    await executeD1(this.db, { sql: 'UPDATE student_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?', params: [tokenHash] });
    return { studentId: row.student_id, displayName: row.display_name, email: row.email, expiresAt: new Date(row.expires_at) };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await executeD1(this.db, { sql: 'UPDATE student_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=? AND revoked_at IS NULL', params: [tokenHash] });
  }
}
