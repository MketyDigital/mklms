import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { StorageProvider } from "@/providers/storage-provider";
import {
  alignedTextX,
  fitFontSizeToWidth,
  parseCertificateVisualLayout,
  resolveCertificateFieldPlacement,
  type CertificateFieldPlacement,
} from "./certificate-layout.ts";
import { REAL_CERTIFICATE_DEFAULT_LAYOUT } from "./default-certificate-layout.ts";
import type {
  CertificateRenderer,
  CertificateTemplateDefinition,
  RenderedCertificate,
} from "./certificate-renderer";
import type { IssuedCertificateRecord } from "../services/certificate-issuance.service";

interface CertificateLayoutConfig {
  nameX?: number;
  nameY?: number;
  nameFontSize?: number;
  dateX?: number;
  dateY?: number;
  dateFontSize?: number;
  idX?: number;
  idY?: number;
  idFontSize?: number;
  pageWidth?: number;
  pageHeight?: number;
}

function numberSetting(
  config: Record<string, unknown>,
  key: keyof CertificateLayoutConfig,
  fallback: number,
): number {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function centeredX(textWidth: number, pageWidth: number): number {
  return Math.max(16, (pageWidth - textWidth) / 2);
}

export class PdfLibCertificateRenderer implements CertificateRenderer {
  private readonly storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  async render(input: {
    certificate: IssuedCertificateRecord;
    template: CertificateTemplateDefinition;
  }): Promise<RenderedCertificate> {
    const { certificate, template } = input;
    let pdf: PDFDocument;

    if (template.backgroundAssetId) {
      if (!this.storage.getObject) {
        throw new Error("The configured storage provider cannot read certificate templates.");
      }
      const background = await this.storage.getObject(template.backgroundAssetId);

      if (background.contentType.includes("pdf")) {
        pdf = await PDFDocument.load(background.bytes);
      } else if (background.contentType.includes("png")) {
        pdf = await PDFDocument.create();
        const image = await pdf.embedPng(background.bytes);
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      } else if (
        background.contentType.includes("jpeg") ||
        background.contentType.includes("jpg")
      ) {
        pdf = await PDFDocument.create();
        const image = await pdf.embedJpg(background.bytes);
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      } else {
        throw new Error("Certificate template must be PDF, PNG, or JPEG.");
      }
    } else {
      pdf = await PDFDocument.create();
      const width = numberSetting(template.layoutConfig, "pageWidth", 842);
      const height = numberSetting(template.layoutConfig, "pageHeight", 595);
      pdf.addPage([width, height]);
    }

    const page = pdf.getPages()[0];
    if (!page) throw new Error("Certificate template does not contain a page.");

    const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();
    const config = template.layoutConfig;
    const visualLayout = parseCertificateVisualLayout(config);

    function drawVisualText(input: {
      text: string;
      field: CertificateFieldPlacement;
      bold?: boolean;
      color: ReturnType<typeof rgb>;
      minimumFontSize?: number;
    }) {
      const font = input.bold ? boldFont : regularFont;
      const placement = resolveCertificateFieldPlacement({
        field: input.field,
        pageWidth: width,
        pageHeight: height,
      });
      const fontSize = fitFontSizeToWidth({
        text: input.text,
        preferredFontSize: placement.fontSize,
        maxWidth: placement.width,
        minimumFontSize: input.minimumFontSize,
        measure: (text, size) => font.widthOfTextAtSize(text, size),
      });
      const textWidth = font.widthOfTextAtSize(input.text, fontSize);
      page.drawText(input.text, {
        x: Math.max(8, alignedTextX({ placement, textWidth })),
        y: Math.max(8, placement.y - fontSize),
        size: fontSize,
        font,
        color: input.color,
      });
    }

    if (visualLayout) {
      drawVisualText({
        text: certificate.certificateNameSnapshot,
        field: visualLayout.name,
        bold: true,
        color: rgb(0.08, 0.08, 0.08),
        minimumFontSize: 14,
      });
      drawVisualText({
        text: certificate.completionDate,
        field: visualLayout.completionDate,
        color: rgb(0.18, 0.18, 0.18),
        minimumFontSize: 8,
      });
      drawVisualText({
        text: certificate.certificateId,
        field: visualLayout.certificateId,
        color: rgb(0.25, 0.25, 0.25),
        minimumFontSize: 7,
      });
    } else {
      // Legacy templates keep their exact raw PDF coordinates.
      const nameFontSize = numberSetting(config, "nameFontSize", REAL_CERTIFICATE_DEFAULT_LAYOUT.nameFontSize);
      const dateFontSize = numberSetting(config, "dateFontSize", REAL_CERTIFICATE_DEFAULT_LAYOUT.dateFontSize);
      const idFontSize = numberSetting(config, "idFontSize", REAL_CERTIFICATE_DEFAULT_LAYOUT.idFontSize);

      const name = certificate.certificateNameSnapshot;
      const nameWidth = boldFont.widthOfTextAtSize(name, nameFontSize);
      const nameX = numberSetting(config, "nameX", centeredX(nameWidth, width));
      const nameY = numberSetting(config, "nameY", height * REAL_CERTIFICATE_DEFAULT_LAYOUT.nameYRatio);

      page.drawText(name, {
        x: nameX,
        y: nameY,
        size: nameFontSize,
        font: boldFont,
        color: rgb(0.08, 0.08, 0.08),
      });

      page.drawText(certificate.completionDate, {
        x: numberSetting(config, "dateX", width * REAL_CERTIFICATE_DEFAULT_LAYOUT.dateXRatio),
        y: numberSetting(config, "dateY", height * REAL_CERTIFICATE_DEFAULT_LAYOUT.dateYRatio),
        size: dateFontSize,
        font: regularFont,
        color: rgb(0.18, 0.18, 0.18),
      });

      page.drawText(certificate.certificateId, {
        x: numberSetting(config, "idX", width * REAL_CERTIFICATE_DEFAULT_LAYOUT.idXRatio),
        y: numberSetting(config, "idY", height * REAL_CERTIFICATE_DEFAULT_LAYOUT.idYRatio),
        size: idFontSize,
        font: regularFont,
        color: rgb(0.25, 0.25, 0.25),
      });
    }

    const bytes = await pdf.save();
    return {
      bytes,
      contentType: "application/pdf",
      fileName: `${certificate.certificateId}.pdf`,
    };
  }
}
