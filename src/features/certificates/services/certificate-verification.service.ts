export interface CertificateVerificationRecord {
  certificateId: string;
  certificateNameSnapshot: string;
  courseTitle: string;
  completionDate: string;
  status: "ISSUED" | "REVOKED";
  issuedAt: Date;
  revokedAt?: Date | null;
}

export interface CertificateVerificationRepository {
  findPublicVerification(
    certificateId: string,
  ): Promise<CertificateVerificationRecord | null>;
}

export type CertificateVerificationResult =
  | { state: "NOT_FOUND" }
  | {
      state: "VERIFIED" | "REVOKED";
      certificateId: string;
      holderName: string;
      courseTitle: string;
      completionDate: string;
      issuedAt: Date;
    };

export class CertificateVerificationService {
  private readonly repository: CertificateVerificationRepository;

  constructor(repository: CertificateVerificationRepository) {
    this.repository = repository;
  }

  async verify(certificateId: string): Promise<CertificateVerificationResult> {
    const record = await this.repository.findPublicVerification(certificateId.trim());
    if (!record) return { state: "NOT_FOUND" };

    return {
      state:
        record.status === "ISSUED" && !record.revokedAt
          ? "VERIFIED"
          : "REVOKED",
      certificateId: record.certificateId,
      holderName: record.certificateNameSnapshot,
      courseTitle: record.courseTitle,
      completionDate: record.completionDate,
      issuedAt: record.issuedAt,
    };
  }
}
