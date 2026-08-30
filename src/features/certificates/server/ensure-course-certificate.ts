import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import { getConfiguredEmailProvider } from "@/providers/smtp-email-provider";
import { getConfiguredStorageProvider } from "@/providers/s3-compatible-storage-provider";
import { PdfLibCertificateRenderer } from "../providers/pdf-lib-certificate-renderer";
import { PostgresCertificateRepository } from "../repositories/postgres-certificate.repository";
import { CertificateDeliveryService } from "../services/certificate-delivery.service";
import { CertificateIssuanceService } from "../services/certificate-issuance.service";

export interface EnsureCourseCertificateResult {
  issued: boolean;
  created: boolean;
  certificateId?: string;
  deliveryStatus:
    | "DELIVERED"
    | "ALREADY_STORED"
    | "PENDING_TEMPLATE"
    | "PENDING_STORAGE"
    | "DELIVERY_FAILED"
    | "NOT_ELIGIBLE";
  emailStatus?: "SENT" | "FAILED" | "SKIPPED";
  error?: string;
}

export async function ensureCourseCertificate(
  studentId: string,
  courseId: string,
): Promise<EnsureCourseCertificateResult> {
  const repository = new PostgresCertificateRepository();
  const settings = await new PostgresSettingsRepository().getPlatformSettings();
  const issuance = new CertificateIssuanceService(repository, {
    certificatePrefix: settings.certificatePrefix,
  });
  const issued = await issuance.issueForCompletedEnrollment(studentId, courseId);

  if (!issued.ok) {
    return {
      issued: false,
      created: false,
      deliveryStatus: "NOT_ELIGIBLE",
    };
  }

  const storedRecord = await repository.findListItemById(issued.certificate.id);
  if (storedRecord?.pdfAssetId) {
    return {
      issued: true,
      created: issued.created,
      certificateId: issued.certificate.certificateId,
      deliveryStatus: "ALREADY_STORED",
    };
  }

  const template = await repository.getActiveTemplate(courseId);
  if (!template) {
    return {
      issued: true,
      created: issued.created,
      certificateId: issued.certificate.certificateId,
      deliveryStatus: "PENDING_TEMPLATE",
    };
  }

  let storage;
  try {
    storage = getConfiguredStorageProvider();
  } catch {
    return {
      issued: true,
      created: issued.created,
      certificateId: issued.certificate.certificateId,
      deliveryStatus: "PENDING_STORAGE",
      error: "Certificate delivery is not available yet.",
    };
  }

  try {
    const delivery = new CertificateDeliveryService({
      renderer: new PdfLibCertificateRenderer(storage),
      storage,
      email: getConfiguredEmailProvider(),
      repository,
    });
    const result = await delivery.deliver(issued.certificate, template);

    return {
      issued: true,
      created: issued.created,
      certificateId: issued.certificate.certificateId,
      deliveryStatus: "DELIVERED",
      emailStatus: result.emailStatus,
    };
  } catch {
    return {
      issued: true,
      created: issued.created,
      certificateId: issued.certificate.certificateId,
      deliveryStatus: "DELIVERY_FAILED",
      error: "Certificate delivery could not be completed.",
    };
  }
}
