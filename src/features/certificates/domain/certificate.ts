import { randomBytes } from "node:crypto";

export type CertificateStatus = "ISSUED" | "REVOKED";

export interface CertificateSnapshotInput {
  studentId: string;
  courseId: string;
  certificateName: string;
  completionDate: Date;
}

export interface CertificateIdentitySnapshot {
  studentId: string;
  courseId: string;
  certificateNameSnapshot: string;
  completionDate: string;
}

export interface CertificateStateLike {
  status: CertificateStatus | string;
  revokedAt?: Date | null;
}

function normalizePrefix(prefix: string): string {
  const normalized = prefix
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "CERT";
}

export function generateCertificateId(prefix: string): string {
  const suffix = randomBytes(6).toString("hex").toUpperCase();
  return `${normalizePrefix(prefix)}-${suffix}`;
}

export function createCertificateSnapshot(
  input: CertificateSnapshotInput,
): CertificateIdentitySnapshot {
  const certificateNameSnapshot = input.certificateName.trim();
  if (!certificateNameSnapshot) {
    throw new Error("Certificate name is required.");
  }

  if (Number.isNaN(input.completionDate.getTime())) {
    throw new Error("A valid completion date is required.");
  }

  return {
    studentId: input.studentId,
    courseId: input.courseId,
    certificateNameSnapshot,
    completionDate: input.completionDate.toISOString().slice(0, 10),
  };
}

export function isCertificateActive(certificate: CertificateStateLike): boolean {
  return certificate.status === "ISSUED" && !certificate.revokedAt;
}
