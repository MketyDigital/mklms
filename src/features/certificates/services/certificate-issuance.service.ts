import {
  createCertificateSnapshot,
  generateCertificateId,
  type CertificateStatus,
} from "../domain/certificate.ts";

export interface CertificateEnrollmentRecord {
  studentId: string;
  courseId: string;
  status: string;
  completedAt?: Date | null;
}

export interface LockedCertificateIdentity {
  studentId: string;
  certificateName: string;
  certificateEmail?: string | null;
  lockedAt?: Date | null;
}

export interface IssuedCertificateRecord {
  id: string;
  certificateId: string;
  studentId: string;
  courseId: string;
  certificateNameSnapshot: string;
  completionDate: string;
  certificateEmailSnapshot?: string | null;
  status: CertificateStatus;
  issuedAt: Date;
  revokedAt?: Date | null;
}

export interface CreateCertificateRecordInput {
  certificateId: string;
  studentId: string;
  courseId: string;
  certificateNameSnapshot: string;
  completionDate: string;
  certificateEmailSnapshot?: string | null;
  issuedAt: Date;
}

export interface CertificateIssuanceRepository {
  findByStudentCourse(
    studentId: string,
    courseId: string,
  ): Promise<IssuedCertificateRecord | null>;
  getEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<CertificateEnrollmentRecord | null>;
  getCertificateIdentity(
    studentId: string,
  ): Promise<LockedCertificateIdentity | null>;
  createCertificate(
    input: CreateCertificateRecordInput,
  ): Promise<IssuedCertificateRecord>;
}

export type CertificateIssuanceResult =
  | {
      ok: true;
      created: boolean;
      certificate: IssuedCertificateRecord;
    }
  | {
      ok: false;
      reason:
        | "COURSE_NOT_COMPLETED"
        | "CERTIFICATE_IDENTITY_NOT_LOCKED";
    };

export interface CertificateIssuanceOptions {
  certificatePrefix: string;
  now?: () => Date;
}

export class CertificateIssuanceService {
  private readonly repository: CertificateIssuanceRepository;
  private readonly certificatePrefix: string;
  private readonly now: () => Date;

  constructor(
    repository: CertificateIssuanceRepository,
    options: CertificateIssuanceOptions,
  ) {
    this.repository = repository;
    this.certificatePrefix = options.certificatePrefix;
    this.now = options.now ?? (() => new Date());
  }

  async issueForCompletedEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<CertificateIssuanceResult> {
    const existing = await this.repository.findByStudentCourse(studentId, courseId);
    if (existing) {
      return { ok: true, created: false, certificate: existing };
    }

    const enrollment = await this.repository.getEnrollment(studentId, courseId);
    if (
      !enrollment ||
      enrollment.status !== "COMPLETED" ||
      !enrollment.completedAt
    ) {
      return { ok: false, reason: "COURSE_NOT_COMPLETED" };
    }

    const identity = await this.repository.getCertificateIdentity(studentId);
    if (!identity?.lockedAt || !identity.certificateName.trim()) {
      return { ok: false, reason: "CERTIFICATE_IDENTITY_NOT_LOCKED" };
    }

    const snapshot = createCertificateSnapshot({
      studentId,
      courseId,
      certificateName: identity.certificateName,
      completionDate: enrollment.completedAt,
    });

    const certificate = await this.repository.createCertificate({
      certificateId: generateCertificateId(this.certificatePrefix),
      ...snapshot,
      certificateEmailSnapshot: identity.certificateEmail ?? null,
      issuedAt: this.now(),
    });

    return { ok: true, created: true, certificate };
  }
}
