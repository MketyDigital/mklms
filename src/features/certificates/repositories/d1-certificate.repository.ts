import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";
import type { CertificateTemplateDefinition } from "../providers/certificate-renderer";
import type { CertificateDeliveryRepository } from "../services/certificate-delivery.service";
import type { CertificateEnrollmentRecord, CertificateIssuanceRepository, CreateCertificateRecordInput, IssuedCertificateRecord, LockedCertificateIdentity } from "../services/certificate-issuance.service";
import type { CertificateListItem, CertificateTemplateRecord, CertificateVerificationView } from "./postgres-certificate.repository";

type CertificateRow = { id: string; certificate_id: string; student_id: string; course_id: string; certificate_name_snapshot: string; certificate_email_snapshot: string | null; completion_date: string; status: "ISSUED" | "REVOKED"; issued_at: string; revoked_at: string | null };
type ListRow = CertificateRow & { course_title: string; pdf_asset_id: string | null; email_delivery_status: string };

function asDate(value: string | null): Date | null { return value ? new Date(value) : null; }

/** D1 certificate issuance, lookup, delivery metadata and revocation persistence. */
export class D1CertificateRepository implements CertificateIssuanceRepository, CertificateDeliveryRepository {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }

  async findByStudentCourse(studentId: string, courseId: string): Promise<IssuedCertificateRecord | null> {
    const rows = await queryD1Rows<CertificateRow>(this.db, { sql: `SELECT id,certificate_id,student_id,course_id,certificate_name_snapshot,certificate_email_snapshot,completion_date,status,issued_at,revoked_at FROM certificates WHERE student_id=? AND course_id=? LIMIT 1`, params: [studentId, courseId] });
    return rows[0] ? this.mapCertificate(rows[0]) : null;
  }

  async getEnrollment(studentId: string, courseId: string): Promise<CertificateEnrollmentRecord | null> {
    const rows = await queryD1Rows<{ student_id: string; course_id: string; status: string; completed_at: string | null }>(this.db, { sql: "SELECT student_id,course_id,status,completed_at FROM enrollments WHERE student_id=? AND course_id=? LIMIT 1", params: [studentId, courseId] });
    const row = rows[0]; return row ? { studentId: row.student_id, courseId: row.course_id, status: row.status, completedAt: asDate(row.completed_at) } : null;
  }

  async getCertificateIdentity(studentId: string): Promise<LockedCertificateIdentity | null> {
    const rows = await queryD1Rows<{ id: string; certificate_name: string; certificate_email: string | null; certificate_identity_locked_at: string | null }>(this.db, { sql: "SELECT id,certificate_name,certificate_email,certificate_identity_locked_at FROM students WHERE id=? LIMIT 1", params: [studentId] });
    const row = rows[0]; return row ? { studentId: row.id, certificateName: row.certificate_name, certificateEmail: row.certificate_email, lockedAt: asDate(row.certificate_identity_locked_at) } : null;
  }

  async createCertificate(input: CreateCertificateRecordInput): Promise<IssuedCertificateRecord> {
    const id = randomUUID();
    await executeD1(this.db, { sql: `INSERT INTO certificates(id,certificate_id,student_id,course_id,certificate_name_snapshot,certificate_email_snapshot,completion_date,status,issued_at)
      SELECT ?,?,?,?,?,?,?,'ISSUED',? WHERE EXISTS(SELECT 1 FROM enrollments WHERE student_id=? AND course_id=? AND status='COMPLETED' AND completed_at IS NOT NULL)
        AND EXISTS(SELECT 1 FROM students WHERE id=? AND certificate_identity_locked_at IS NOT NULL)
      ON CONFLICT(student_id,course_id) DO NOTHING`, params: [id,input.certificateId,input.studentId,input.courseId,input.certificateNameSnapshot,input.certificateEmailSnapshot ?? null,input.completionDate,input.issuedAt.toISOString(),input.studentId,input.courseId,input.studentId] });
    const created = await this.findByStudentCourse(input.studentId,input.courseId);
    if (!created) throw new Error("Certificate creation requires a completed enrollment and locked identity.");
    return created;
  }

  async listForStudent(studentId: string): Promise<CertificateListItem[]> { return this.list("WHERE certificate.student_id=?", [studentId], "ORDER BY certificate.issued_at DESC"); }
  async listAll(limit = 200): Promise<CertificateListItem[]> { return this.list("", [], "ORDER BY certificate.issued_at DESC LIMIT ?", [Math.max(1,Math.min(1000,Math.floor(limit)))]); }

  private async list(where: string, params: (string | number)[], tail: string, tailParams: (string | number)[] = []): Promise<CertificateListItem[]> {
    const rows = await queryD1Rows<ListRow>(this.db, { sql: `SELECT certificate.id,certificate.certificate_id,certificate.student_id,certificate.course_id,course.title AS course_title,certificate.certificate_name_snapshot,certificate.certificate_email_snapshot,certificate.completion_date,certificate.status,certificate.issued_at,certificate.revoked_at,certificate.pdf_asset_id,certificate.email_delivery_status FROM certificates certificate JOIN courses course ON course.id=certificate.course_id ${where} ${tail}`, params: [...params,...tailParams] });
    return rows.map((row) => this.mapListItem(row));
  }

  async findListItemById(id: string): Promise<CertificateListItem | null> { return (await this.list("WHERE certificate.id=?",[id],"LIMIT 1"))[0] ?? null; }
  async findForStudent(id: string, studentId: string): Promise<CertificateListItem | null> { const row=await this.findListItemById(id); return row?.studentId===studentId?row:null; }

  async findPublicVerification(certificateId: string): Promise<CertificateVerificationView | null> {
    const rows=await queryD1Rows<{certificate_id:string;certificate_name_snapshot:string;course_title:string;completion_date:string;status:"ISSUED"|"REVOKED";issued_at:string;revoked_at:string|null}>(this.db,{sql:`SELECT certificate.certificate_id,certificate.certificate_name_snapshot,course.title AS course_title,certificate.completion_date,certificate.status,certificate.issued_at,certificate.revoked_at FROM certificates certificate JOIN courses course ON course.id=certificate.course_id WHERE UPPER(certificate.certificate_id)=UPPER(?) LIMIT 1`,params:[certificateId.trim()]});
    const row=rows[0];return row?{certificateId:row.certificate_id,certificateNameSnapshot:row.certificate_name_snapshot,courseTitle:row.course_title,completionDate:row.completion_date,status:row.status,issuedAt:new Date(row.issued_at),revokedAt:asDate(row.revoked_at)}:null;
  }

  async getActiveTemplate(courseId: string): Promise<CertificateTemplateRecord | null> {
    const rows=await queryD1Rows<{id:string;name:string;course_id:string|null;background_asset_id:string|null;signature_asset_id:string|null;layout_config_json:string;certificate_prefix:string;active:number}>(this.db,{sql:`SELECT id,name,course_id,background_asset_id,signature_asset_id,layout_config_json,certificate_prefix,active FROM certificate_templates WHERE active=1 AND (course_id=? OR course_id IS NULL) ORDER BY CASE WHEN course_id=? THEN 0 ELSE 1 END,updated_at DESC LIMIT 1`,params:[courseId,courseId]});
    const row=rows[0];if(!row)return null;let layoutConfig:CertificateTemplateDefinition["layoutConfig"]={};try{layoutConfig=JSON.parse(row.layout_config_json) as CertificateTemplateDefinition["layoutConfig"];}catch{throw new Error("Stored certificate template layout is invalid JSON.");}
    return {id:row.id,name:row.name,courseId:row.course_id,backgroundAssetId:row.background_asset_id,signatureAssetId:row.signature_asset_id,layoutConfig,active:Boolean(row.active)};
  }

  async revokeCertificate(id:string,revokedAt=new Date()):Promise<void>{await executeD1(this.db,{sql:"UPDATE certificates SET status='REVOKED',revoked_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",params:[revokedAt.toISOString(),id]});}
  async restoreCertificate(id:string):Promise<void>{await executeD1(this.db,{sql:"UPDATE certificates SET status='ISSUED',revoked_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",params:[id]});}
  async setPdfAsset(certificateId:string,assetId:string):Promise<void>{await executeD1(this.db,{sql:"UPDATE certificates SET pdf_asset_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",params:[assetId,certificateId]});}
  async markEmailSent(certificateId:string,sentAt:Date):Promise<void>{await executeD1(this.db,{sql:"UPDATE certificates SET email_delivery_status='SENT',emailed_at=?,email_last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",params:[sentAt.toISOString(),certificateId]});}
  async markEmailFailed(certificateId:string,error:string):Promise<void>{await executeD1(this.db,{sql:"UPDATE certificates SET email_delivery_status='FAILED',email_last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",params:[error.slice(0,4000),certificateId]});}

  private mapCertificate(row:CertificateRow):IssuedCertificateRecord{return{id:row.id,certificateId:row.certificate_id,studentId:row.student_id,courseId:row.course_id,certificateNameSnapshot:row.certificate_name_snapshot,certificateEmailSnapshot:row.certificate_email_snapshot,completionDate:row.completion_date,status:row.status,issuedAt:new Date(row.issued_at),revokedAt:asDate(row.revoked_at)};}
  private mapListItem(row:ListRow):CertificateListItem{return{id:row.id,certificateId:row.certificate_id,studentId:row.student_id,courseId:row.course_id,courseTitle:row.course_title,certificateNameSnapshot:row.certificate_name_snapshot,certificateEmailSnapshot:row.certificate_email_snapshot,completionDate:row.completion_date,status:row.status,issuedAt:new Date(row.issued_at),revokedAt:asDate(row.revoked_at),pdfAssetId:row.pdf_asset_id,emailDeliveryStatus:row.email_delivery_status};}
}
