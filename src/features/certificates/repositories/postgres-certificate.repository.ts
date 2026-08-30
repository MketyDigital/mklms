import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type {
  CertificateEnrollmentRecord,
  CertificateIssuanceRepository,
  CreateCertificateRecordInput,
  IssuedCertificateRecord,
  LockedCertificateIdentity,
} from "../services/certificate-issuance.service";

export class PostgresCertificateRepository implements CertificateIssuanceRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async findByStudentCourse(
    studentId: string,
    courseId: string,
  ): Promise<IssuedCertificateRecord | null> {
    const result = await this.pool.query<{
      id: string;
      certificate_id: string;
      student_id: string;
      course_id: string;
      certificate_name_snapshot: string;
      certificate_email_snapshot: string | null;
      completion_date: string;
      status: "ISSUED" | "REVOKED";
      issued_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, certificate_id, student_id, course_id,
              certificate_name_snapshot, certificate_email_snapshot,
              completion_date::text, status, issued_at, revoked_at
       FROM certificates
       WHERE student_id = $1 AND course_id = $2
       LIMIT 1`,
      [studentId, courseId],
    );

    return result.rows[0] ? this.mapCertificate(result.rows[0]) : null;
  }

  async getEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<CertificateEnrollmentRecord | null> {
    const result = await this.pool.query<{
      student_id: string;
      course_id: string;
      status: string;
      completed_at: Date | null;
    }>(
      `SELECT student_id, course_id, status, completed_at
       FROM enrollments
       WHERE student_id = $1 AND course_id = $2
       LIMIT 1`,
      [studentId, courseId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      studentId: row.student_id,
      courseId: row.course_id,
      status: row.status,
      completedAt: row.completed_at,
    };
  }

  async getCertificateIdentity(
    studentId: string,
  ): Promise<LockedCertificateIdentity | null> {
    const result = await this.pool.query<{
      id: string;
      certificate_name: string;
      certificate_email: string | null;
      certificate_identity_locked_at: Date | null;
    }>(
      `SELECT id, certificate_name, certificate_email,
              certificate_identity_locked_at
       FROM students
       WHERE id = $1
       LIMIT 1`,
      [studentId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      studentId: row.id,
      certificateName: row.certificate_name,
      certificateEmail: row.certificate_email,
      lockedAt: row.certificate_identity_locked_at,
    };
  }

  async createCertificate(
    input: CreateCertificateRecordInput,
  ): Promise<IssuedCertificateRecord> {
    const result = await this.pool.query<{
      id: string;
      certificate_id: string;
      student_id: string;
      course_id: string;
      certificate_name_snapshot: string;
      certificate_email_snapshot: string | null;
      completion_date: string;
      status: "ISSUED" | "REVOKED";
      issued_at: Date;
      revoked_at: Date | null;
    }>(
      `INSERT INTO certificates (
         id, certificate_id, student_id, course_id,
         certificate_name_snapshot, certificate_email_snapshot,
         completion_date, status, issued_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ISSUED', $8)
       RETURNING id, certificate_id, student_id, course_id,
                 certificate_name_snapshot, certificate_email_snapshot,
                 completion_date::text, status, issued_at, revoked_at`,
      [
        randomUUID(),
        input.certificateId,
        input.studentId,
        input.courseId,
        input.certificateNameSnapshot,
        input.certificateEmailSnapshot ?? null,
        input.completionDate,
        input.issuedAt,
      ],
    );

    return this.mapCertificate(result.rows[0]);
  }

  private mapCertificate(row: {
    id: string;
    certificate_id: string;
    student_id: string;
    course_id: string;
    certificate_name_snapshot: string;
    certificate_email_snapshot: string | null;
    completion_date: string;
    status: "ISSUED" | "REVOKED";
    issued_at: Date;
    revoked_at: Date | null;
  }): IssuedCertificateRecord {
    return {
      id: row.id,
      certificateId: row.certificate_id,
      studentId: row.student_id,
      courseId: row.course_id,
      certificateNameSnapshot: row.certificate_name_snapshot,
      certificateEmailSnapshot: row.certificate_email_snapshot,
      completionDate: row.completion_date,
      status: row.status,
      issuedAt: row.issued_at,
      revokedAt: row.revoked_at,
    };
  }
}
