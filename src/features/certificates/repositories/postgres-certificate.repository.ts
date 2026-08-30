import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { CertificateTemplateDefinition } from "../providers/certificate-renderer";
import type { CertificateDeliveryRepository } from "../services/certificate-delivery.service";
import type {
  CertificateEnrollmentRecord,
  CertificateIssuanceRepository,
  CreateCertificateRecordInput,
  IssuedCertificateRecord,
  LockedCertificateIdentity,
} from "../services/certificate-issuance.service";

export interface CertificateListItem {
  id: string;
  certificateId: string;
  studentId: string;
  courseId: string;
  courseTitle: string;
  certificateNameSnapshot: string;
  certificateEmailSnapshot?: string | null;
  completionDate: string;
  status: "ISSUED" | "REVOKED";
  issuedAt: Date;
  revokedAt?: Date | null;
  pdfAssetId?: string | null;
  emailDeliveryStatus: string;
}

export interface CertificateVerificationView {
  certificateId: string;
  certificateNameSnapshot: string;
  courseTitle: string;
  completionDate: string;
  status: "ISSUED" | "REVOKED";
  issuedAt: Date;
  revokedAt?: Date | null;
}

export interface CertificateTemplateRecord extends CertificateTemplateDefinition {
  courseId?: string | null;
  active: boolean;
}

export class PostgresCertificateRepository
  implements CertificateIssuanceRepository, CertificateDeliveryRepository
{
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

  async listForStudent(studentId: string): Promise<CertificateListItem[]> {
    const result = await this.pool.query<{
      id: string;
      certificate_id: string;
      student_id: string;
      course_id: string;
      course_title: string;
      certificate_name_snapshot: string;
      certificate_email_snapshot: string | null;
      completion_date: string;
      status: "ISSUED" | "REVOKED";
      issued_at: Date;
      revoked_at: Date | null;
      pdf_asset_id: string | null;
      email_delivery_status: string;
    }>(
      `SELECT certificate.id, certificate.certificate_id,
              certificate.student_id, certificate.course_id,
              course.title AS course_title,
              certificate.certificate_name_snapshot,
              certificate.certificate_email_snapshot,
              certificate.completion_date::text,
              certificate.status, certificate.issued_at,
              certificate.revoked_at, certificate.pdf_asset_id,
              certificate.email_delivery_status
       FROM certificates certificate
       JOIN courses course ON course.id = certificate.course_id
       WHERE certificate.student_id = $1
       ORDER BY certificate.issued_at DESC`,
      [studentId],
    );

    return result.rows.map((row) => this.mapListItem(row));
  }

  async listAll(limit = 200): Promise<CertificateListItem[]> {
    const result = await this.pool.query<{
      id: string;
      certificate_id: string;
      student_id: string;
      course_id: string;
      course_title: string;
      certificate_name_snapshot: string;
      certificate_email_snapshot: string | null;
      completion_date: string;
      status: "ISSUED" | "REVOKED";
      issued_at: Date;
      revoked_at: Date | null;
      pdf_asset_id: string | null;
      email_delivery_status: string;
    }>(
      `SELECT certificate.id, certificate.certificate_id,
              certificate.student_id, certificate.course_id,
              course.title AS course_title,
              certificate.certificate_name_snapshot,
              certificate.certificate_email_snapshot,
              certificate.completion_date::text,
              certificate.status, certificate.issued_at,
              certificate.revoked_at, certificate.pdf_asset_id,
              certificate.email_delivery_status
       FROM certificates certificate
       JOIN courses course ON course.id = certificate.course_id
       ORDER BY certificate.issued_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(1000, Math.floor(limit)))],
    );

    return result.rows.map((row) => this.mapListItem(row));
  }

  async findListItemById(id: string): Promise<CertificateListItem | null> {
    const result = await this.pool.query<{
      id: string;
      certificate_id: string;
      student_id: string;
      course_id: string;
      course_title: string;
      certificate_name_snapshot: string;
      certificate_email_snapshot: string | null;
      completion_date: string;
      status: "ISSUED" | "REVOKED";
      issued_at: Date;
      revoked_at: Date | null;
      pdf_asset_id: string | null;
      email_delivery_status: string;
    }>(
      `SELECT certificate.id, certificate.certificate_id,
              certificate.student_id, certificate.course_id,
              course.title AS course_title,
              certificate.certificate_name_snapshot,
              certificate.certificate_email_snapshot,
              certificate.completion_date::text,
              certificate.status, certificate.issued_at,
              certificate.revoked_at, certificate.pdf_asset_id,
              certificate.email_delivery_status
       FROM certificates certificate
       JOIN courses course ON course.id = certificate.course_id
       WHERE certificate.id = $1
       LIMIT 1`,
      [id],
    );

    return result.rows[0] ? this.mapListItem(result.rows[0]) : null;
  }

  async findForStudent(
    id: string,
    studentId: string,
  ): Promise<CertificateListItem | null> {
    const certificate = await this.findListItemById(id);
    return certificate?.studentId === studentId ? certificate : null;
  }

  async findPublicVerification(
    certificateId: string,
  ): Promise<CertificateVerificationView | null> {
    const result = await this.pool.query<{
      certificate_id: string;
      certificate_name_snapshot: string;
      course_title: string;
      completion_date: string;
      status: "ISSUED" | "REVOKED";
      issued_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT certificate.certificate_id,
              certificate.certificate_name_snapshot,
              course.title AS course_title,
              certificate.completion_date::text,
              certificate.status, certificate.issued_at,
              certificate.revoked_at
       FROM certificates certificate
       JOIN courses course ON course.id = certificate.course_id
       WHERE UPPER(certificate.certificate_id) = UPPER($1)
       LIMIT 1`,
      [certificateId.trim()],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      certificateId: row.certificate_id,
      certificateNameSnapshot: row.certificate_name_snapshot,
      courseTitle: row.course_title,
      completionDate: row.completion_date,
      status: row.status,
      issuedAt: row.issued_at,
      revokedAt: row.revoked_at,
    };
  }

  async getActiveTemplate(
    courseId: string,
  ): Promise<CertificateTemplateRecord | null> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      course_id: string | null;
      background_asset_id: string | null;
      signature_asset_id: string | null;
      layout_config_json: Record<string, unknown>;
      active: boolean;
    }>(
      `SELECT id, name, course_id, background_asset_id,
              signature_asset_id, layout_config_json, active
       FROM certificate_templates
       WHERE active = TRUE
         AND (course_id = $1 OR course_id IS NULL)
       ORDER BY CASE WHEN course_id = $1 THEN 0 ELSE 1 END,
                updated_at DESC
       LIMIT 1`,
      [courseId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      courseId: row.course_id,
      backgroundAssetId: row.background_asset_id,
      signatureAssetId: row.signature_asset_id,
      layoutConfig: row.layout_config_json ?? {},
      active: row.active,
    };
  }

  async revokeCertificate(id: string, revokedAt = new Date()): Promise<void> {
    await this.pool.query(
      `UPDATE certificates
       SET status = 'REVOKED', revoked_at = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, revokedAt],
    );
  }

  async restoreCertificate(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE certificates
       SET status = 'ISSUED', revoked_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  }

  async setPdfAsset(certificateId: string, assetId: string): Promise<void> {
    await this.pool.query(
      `UPDATE certificates
       SET pdf_asset_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [certificateId, assetId],
    );
  }

  async markEmailSent(certificateId: string, sentAt: Date): Promise<void> {
    await this.pool.query(
      `UPDATE certificates
       SET email_delivery_status = 'SENT', emailed_at = $2,
           email_last_error = NULL, updated_at = NOW()
       WHERE id = $1`,
      [certificateId, sentAt],
    );
  }

  async markEmailFailed(certificateId: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE certificates
       SET email_delivery_status = 'FAILED', email_last_error = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [certificateId, error.slice(0, 4000)],
    );
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

  private mapListItem(row: {
    id: string;
    certificate_id: string;
    student_id: string;
    course_id: string;
    course_title: string;
    certificate_name_snapshot: string;
    certificate_email_snapshot: string | null;
    completion_date: string;
    status: "ISSUED" | "REVOKED";
    issued_at: Date;
    revoked_at: Date | null;
    pdf_asset_id: string | null;
    email_delivery_status: string;
  }): CertificateListItem {
    return {
      id: row.id,
      certificateId: row.certificate_id,
      studentId: row.student_id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      certificateNameSnapshot: row.certificate_name_snapshot,
      certificateEmailSnapshot: row.certificate_email_snapshot,
      completionDate: row.completion_date,
      status: row.status,
      issuedAt: row.issued_at,
      revokedAt: row.revoked_at,
      pdfAssetId: row.pdf_asset_id,
      emailDeliveryStatus: row.email_delivery_status,
    };
  }
}
