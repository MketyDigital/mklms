import type { EmailProvider } from "@/providers/email-provider";
import type { StorageProvider } from "@/providers/storage-provider";
import type {
  CertificateRenderer,
  CertificateTemplateDefinition,
} from "../providers/certificate-renderer";
import type { IssuedCertificateRecord } from "./certificate-issuance.service";

export interface CertificateDeliveryRepository {
  setPdfAsset(certificateId: string, assetId: string): Promise<void>;
  markEmailSent(certificateId: string, sentAt: Date): Promise<void>;
  markEmailFailed(certificateId: string, error: string): Promise<void>;
}

export interface CertificateDeliveryDependencies {
  renderer: CertificateRenderer;
  storage: StorageProvider;
  email?: EmailProvider | null;
  repository: CertificateDeliveryRepository;
  now?: () => Date;
}

export type CertificateDeliveryResult = {
  ok: true;
  pdfAssetId: string;
  emailStatus: "SENT" | "FAILED" | "SKIPPED";
};

export class CertificateDeliveryService {
  private readonly renderer: CertificateRenderer;
  private readonly storage: StorageProvider;
  private readonly email?: EmailProvider | null;
  private readonly repository: CertificateDeliveryRepository;
  private readonly now: () => Date;

  constructor(dependencies: CertificateDeliveryDependencies) {
    this.renderer = dependencies.renderer;
    this.storage = dependencies.storage;
    this.email = dependencies.email;
    this.repository = dependencies.repository;
    this.now = dependencies.now ?? (() => new Date());
  }

  async deliver(
    certificate: IssuedCertificateRecord,
    template: CertificateTemplateDefinition,
  ): Promise<CertificateDeliveryResult> {
    const rendered = await this.renderer.render({ certificate, template });
    const stored = await this.storage.putObject({
      key: `certificates/${certificate.studentId}/${rendered.fileName}`,
      bytes: rendered.bytes,
      contentType: rendered.contentType,
      visibility: "private",
    });

    await this.repository.setPdfAsset(certificate.id, stored.assetId);

    const recipient = certificate.certificateEmailSnapshot?.trim();
    if (!recipient || !this.email) {
      return {
        ok: true,
        pdfAssetId: stored.assetId,
        emailStatus: "SKIPPED",
      };
    }

    try {
      await this.email.sendEmail({
        to: recipient,
        subject: "Your certificate",
        text: `Your certificate ${certificate.certificateId} is attached.`,
        attachments: [
          {
            fileName: rendered.fileName,
            bytes: rendered.bytes,
            contentType: rendered.contentType,
          },
        ],
      });
      await this.repository.markEmailSent(certificate.id, this.now());

      return {
        ok: true,
        pdfAssetId: stored.assetId,
        emailStatus: "SENT",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email delivery failed.";
      await this.repository.markEmailFailed(certificate.id, message);

      return {
        ok: true,
        pdfAssetId: stored.assetId,
        emailStatus: "FAILED",
      };
    }
  }
}
