import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type {
  AccessRepository,
  ActiveCredentialRecord,
  ActiveSessionRecord,
  CompleteVerifiedClaimRepositoryInput,
  CreateSessionInput,
  CreateStudentInput,
  StudentRecord,
} from "./access.repository";
import type {
  AccessCodeHash,
  ClaimIdentityInput,
  PreauthorizationRecord,
} from "../types";

export class PostgresAccessRepository implements AccessRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async findPreauthorization(
    identity: ClaimIdentityInput,
  ): Promise<PreauthorizationRecord | null> {
    const email = identity.email?.trim().toLowerCase() || null;
    const phone = identity.phone?.replace(/\D/g, "") || null;

    const result = await this.pool.query<{
      id: string;
      email: string | null;
      phone: string | null;
      name_hint: string | null;
      course_id: string | null;
      status: PreauthorizationRecord["status"];
      claim_strategy: NonNullable<PreauthorizationRecord["claimStrategy"]>;
      claim_code_hash: string | null;
      claim_requested_at: Date | null;
      manual_approved_at: Date | null;
    }>(
      `SELECT id, email, phone, name_hint, course_id, status,
              claim_strategy, claim_code_hash, claim_requested_at,
              manual_approved_at
       FROM preauthorizations
       WHERE status = 'PREAUTHORIZED'
         AND (
           ($1::text IS NOT NULL AND LOWER(email) = $1)
           OR ($2::text IS NOT NULL AND phone = $2)
         )
       ORDER BY created_at ASC
       LIMIT 1`,
      [email, phone],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      nameHint: row.name_hint,
      courseId: row.course_id,
      status: row.status,
      claimStrategy: row.claim_strategy,
      claimCodeHash: row.claim_code_hash,
      claimRequestedAt: row.claim_requested_at
        ? new Date(row.claim_requested_at)
        : null,
      manualApprovedAt: row.manual_approved_at
        ? new Date(row.manual_approved_at)
        : null,
    };
  }

  async markPreauthorizationClaimRequested(
    preauthorizationId: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE preauthorizations
       SET claim_requested_at = COALESCE(claim_requested_at, NOW()),
           updated_at = NOW()
       WHERE id = $1 AND status = 'PREAUTHORIZED'`,
      [preauthorizationId],
    );
  }

  async createStudent(input: CreateStudentInput): Promise<StudentRecord> {
    const id = randomUUID();
    const email = input.email?.trim().toLowerCase() || null;
    const phone = input.phone?.replace(/\D/g, "") || null;

    const result = await this.pool.query<{
      id: string;
      display_name: string;
      email: string | null;
      phone: string | null;
      certificate_name: string;
      certificate_email: string | null;
    }>(
      `INSERT INTO students (
         id, display_name, email, phone, certificate_name,
         certificate_email, certificate_identity_locked_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, display_name, email, phone, certificate_name, certificate_email`,
      [
        id,
        input.displayName,
        email,
        phone,
        input.certificateName,
        input.certificateEmail?.trim().toLowerCase() || null,
      ],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      certificateName: row.certificate_name,
      certificateEmail: row.certificate_email,
    };
  }

  async markPreauthorizationClaimed(
    preauthorizationId: string,
    studentId: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE preauthorizations
       SET status = 'CLAIMED', claimed_by_student_id = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'PREAUTHORIZED'`,
      [preauthorizationId, studentId],
    );
  }

  async replaceAccessCredential(
    studentId: string,
    credential: {
      hash: AccessCodeHash;
      lookupHash: string;
      prefix: string;
    },
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE student_access_credentials
         SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW()
         WHERE student_id = $1 AND provider_type = 'access-code' AND status = 'ACTIVE'`,
        [studentId],
      );
      await client.query(
        `INSERT INTO student_access_credentials (
           id, student_id, provider_type, credential_lookup_hash,
           credential_hash, credential_salt, credential_algorithm,
           credential_prefix, status
         )
         VALUES ($1, $2, 'access-code', $3, $4, $5, $6, $7, 'ACTIVE')`,
        [
          randomUUID(),
          studentId,
          credential.lookupHash,
          credential.hash.hash,
          credential.hash.salt,
          credential.hash.algorithm,
          credential.prefix,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async activateEnrollment(studentId: string, courseId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO enrollments (
         id, student_id, course_id, status, authorized_at, activated_at
       )
       VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (student_id, course_id)
       DO UPDATE SET status = 'ACTIVE', activated_at = NOW(), updated_at = NOW()`,
      [randomUUID(), studentId, courseId],
    );
  }

  async completeVerifiedClaim(
    input: CompleteVerifiedClaimRepositoryInput,
  ): Promise<StudentRecord> {
    const client = await this.pool.connect();
    const email = input.student.email?.trim().toLowerCase() || null;
    const phone = input.student.phone?.replace(/\D/g, "") || null;

    try {
      await client.query("BEGIN");

      const preauthorization = await client.query<{ id: string }>(
        `SELECT id
         FROM preauthorizations
         WHERE id = $1 AND status = 'PREAUTHORIZED'
         FOR UPDATE`,
        [input.preauthorizationId],
      );
      if (!preauthorization.rows[0]) {
        throw new Error("Preauthorization is no longer available for claiming.");
      }

      const existing = await client.query<{
        id: string;
        display_name: string;
        email: string | null;
        phone: string | null;
        status: string;
        certificate_name: string;
        certificate_email: string | null;
      }>(
        `SELECT id, display_name, email, phone, status,
                certificate_name, certificate_email
         FROM students
         WHERE ($1::text IS NOT NULL AND LOWER(email) = $1)
            OR ($2::text IS NOT NULL AND phone = $2)
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE`,
        [email, phone],
      );

      let student: StudentRecord;
      const existingStudent = existing.rows[0];
      if (existingStudent) {
        if (existingStudent.status !== "ACTIVE") {
          throw new Error("Existing student access is not active.");
        }
        student = {
          id: existingStudent.id,
          displayName: existingStudent.display_name,
          email: existingStudent.email,
          phone: existingStudent.phone,
          certificateName: existingStudent.certificate_name,
          certificateEmail: existingStudent.certificate_email,
        };
      } else {
        const studentId = randomUUID();
        const created = await client.query<{
          id: string;
          display_name: string;
          email: string | null;
          phone: string | null;
          certificate_name: string;
          certificate_email: string | null;
        }>(
          `INSERT INTO students (
             id, display_name, email, phone, certificate_name,
             certificate_email, certificate_identity_locked_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING id, display_name, email, phone,
                     certificate_name, certificate_email`,
          [
            studentId,
            input.student.displayName,
            email,
            phone,
            input.student.certificateName,
            input.student.certificateEmail?.trim().toLowerCase() || null,
          ],
        );
        const row = created.rows[0];
        student = {
          id: row.id,
          displayName: row.display_name,
          email: row.email,
          phone: row.phone,
          certificateName: row.certificate_name,
          certificateEmail: row.certificate_email,
        };
      }

      await client.query(
        `UPDATE student_access_credentials
         SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW()
         WHERE student_id = $1
           AND provider_type = 'access-code'
           AND status = 'ACTIVE'`,
        [student.id],
      );
      await client.query(
        `INSERT INTO student_access_credentials (
           id, student_id, provider_type, credential_lookup_hash,
           credential_hash, credential_salt, credential_algorithm,
           credential_prefix, status
         )
         VALUES ($1, $2, 'access-code', $3, $4, $5, $6, $7, 'ACTIVE')`,
        [
          randomUUID(),
          student.id,
          input.credential.lookupHash,
          input.credential.hash.hash,
          input.credential.hash.salt,
          input.credential.hash.algorithm,
          input.credential.prefix,
        ],
      );

      if (input.courseId) {
        await client.query(
          `INSERT INTO enrollments (
             id, student_id, course_id, status, authorized_at, activated_at
           )
           VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
           ON CONFLICT (student_id, course_id)
           DO UPDATE SET status = 'ACTIVE', activated_at = NOW(), updated_at = NOW()`,
          [randomUUID(), student.id, input.courseId],
        );
      }

      const claimed = await client.query(
        `UPDATE preauthorizations
         SET status = 'CLAIMED', claimed_by_student_id = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'PREAUTHORIZED'`,
        [input.preauthorizationId, student.id],
      );
      if (claimed.rowCount !== 1) {
        throw new Error("Preauthorization could not be finalized.");
      }

      await client.query("COMMIT");
      return student;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findActiveCredentialByLookupHash(
    lookupHash: string,
  ): Promise<ActiveCredentialRecord | null> {
    const result = await this.pool.query<{
      student_id: string;
      credential_hash: string;
      credential_salt: string;
      credential_algorithm: "scrypt";
    }>(
      `SELECT student_id, credential_hash, credential_salt, credential_algorithm
       FROM student_access_credentials
       WHERE credential_lookup_hash = $1
         AND provider_type = 'access-code'
         AND status = 'ACTIVE'
       LIMIT 1`,
      [lookupHash],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      studentId: row.student_id,
      status: "ACTIVE",
      hash: {
        hash: row.credential_hash,
        salt: row.credential_salt,
        algorithm: row.credential_algorithm,
      },
    };
  }

  async createSession(
    studentId: string,
    input: CreateSessionInput,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO student_sessions (id, student_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), studentId, input.tokenHash, input.expiresAt],
    );
  }

  async findActiveSessionByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<ActiveSessionRecord | null> {
    const result = await this.pool.query<{
      student_id: string;
      display_name: string;
      email: string | null;
      expires_at: Date;
    }>(
      `SELECT s.student_id, st.display_name, st.email, s.expires_at
       FROM student_sessions s
       JOIN students st ON st.id = s.student_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > $2
         AND st.status = 'ACTIVE'
       LIMIT 1`,
      [tokenHash, now],
    );

    const row = result.rows[0];
    if (!row) return null;

    await this.pool.query(
      `UPDATE student_sessions SET last_seen_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );

    return {
      studentId: row.student_id,
      displayName: row.display_name,
      email: row.email,
      expiresAt: new Date(row.expires_at),
    };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE student_sessions
       SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }
}
