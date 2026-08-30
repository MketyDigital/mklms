import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type {
  AdminAccessRepository,
  AdminStudentSummary,
  CreatePreauthorizationInput,
  StudentAccessStatus,
} from "./admin-access.repository";
import type { AccessCodeHash, PreauthorizationRecord } from "../types";

export class PostgresAdminAccessRepository implements AdminAccessRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async createPreauthorization(
    input: CreatePreauthorizationInput,
  ): Promise<PreauthorizationRecord> {
    const id = randomUUID();
    const result = await this.pool.query<{
      id: string;
      email: string | null;
      phone: string | null;
      name_hint: string | null;
      course_id: string | null;
      status: PreauthorizationRecord["status"];
      claim_strategy: NonNullable<PreauthorizationRecord["claimStrategy"]>;
      claim_code_hash: string | null;
    }>(
      `INSERT INTO preauthorizations (
         id, email, phone, name_hint, course_id, claim_strategy,
         claim_code_hash, source, external_reference
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, email, phone, name_hint, course_id, status,
                 claim_strategy, claim_code_hash`,
      [
        id,
        input.email ?? null,
        input.phone ?? null,
        input.nameHint ?? null,
        input.courseId ?? null,
        input.claimStrategy,
        input.claimCodeHash ?? null,
        input.source,
        input.externalReference ?? null,
      ],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      nameHint: row.name_hint,
      courseId: row.course_id,
      status: row.status,
      claimStrategy: row.claim_strategy,
      claimCodeHash: row.claim_code_hash,
    };
  }

  async listPreauthorizations(limit = 100): Promise<PreauthorizationRecord[]> {
    const result = await this.pool.query<{
      id: string;
      email: string | null;
      phone: string | null;
      name_hint: string | null;
      course_id: string | null;
      status: PreauthorizationRecord["status"];
      claim_strategy: NonNullable<PreauthorizationRecord["claimStrategy"]>;
      claim_code_hash: string | null;
    }>(
      `SELECT id, email, phone, name_hint, course_id, status,
              claim_strategy, claim_code_hash
       FROM preauthorizations
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      phone: row.phone,
      nameHint: row.name_hint,
      courseId: row.course_id,
      status: row.status,
      claimStrategy: row.claim_strategy,
      claimCodeHash: row.claim_code_hash,
    }));
  }

  async listStudents(limit = 100): Promise<AdminStudentSummary[]> {
    const result = await this.pool.query<{
      id: string;
      display_name: string;
      email: string | null;
      phone: string | null;
      status: StudentAccessStatus;
      created_at: Date;
    }>(
      `SELECT id, display_name, email, phone, status, created_at
       FROM students
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: new Date(row.created_at),
    }));
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
         VALUES ($1,$2,'access-code',$3,$4,$5,$6,$7,'ACTIVE')`,
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

  async setStudentStatus(
    studentId: string,
    status: StudentAccessStatus,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE students SET status = $2, updated_at = NOW() WHERE id = $1`,
      [studentId, status],
    );

    if (status !== "ACTIVE") {
      await this.pool.query(
        `UPDATE student_sessions
         SET revoked_at = NOW()
         WHERE student_id = $1 AND revoked_at IS NULL`,
        [studentId],
      );
    }
  }
}
