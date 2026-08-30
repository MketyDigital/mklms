import type { IssuedCertificateRecord } from "../services/certificate-issuance.service";

export interface CertificateTemplateDefinition {
  id: string;
  name: string;
  backgroundAssetId?: string | null;
  signatureAssetId?: string | null;
  layoutConfig: Record<string, unknown>;
}

export interface RenderedCertificate {
  bytes: Uint8Array;
  contentType: "application/pdf" | string;
  fileName: string;
}

export interface CertificateRenderer {
  render(input: {
    certificate: IssuedCertificateRecord;
    template: CertificateTemplateDefinition;
  }): Promise<RenderedCertificate>;
}
