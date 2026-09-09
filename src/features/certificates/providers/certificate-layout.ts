export type CertificateTextAlign = "left" | "center" | "right";

export interface CertificateFieldPlacement {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  fontSize: number;
  align: CertificateTextAlign;
}

export interface CertificateVisualLayoutV2 {
  version: 2;
  name: CertificateFieldPlacement;
  completionDate: CertificateFieldPlacement;
  certificateId: CertificateFieldPlacement;
}

export interface ResolvedCertificatePlacement {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  align: CertificateTextAlign;
}

function finiteRatio(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function finitePositive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function alignValue(value: unknown): CertificateTextAlign {
  return value === "left" || value === "right" || value === "center" ? value : "center";
}

function parseField(value: unknown, fallback: CertificateFieldPlacement): CertificateFieldPlacement {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    xRatio: finiteRatio(raw.xRatio, fallback.xRatio),
    yRatio: finiteRatio(raw.yRatio, fallback.yRatio),
    widthRatio: Math.max(0.03, finiteRatio(raw.widthRatio, fallback.widthRatio)),
    fontSize: finitePositive(raw.fontSize, fallback.fontSize),
    align: alignValue(raw.align ?? fallback.align),
  };
}

export const DEFAULT_CERTIFICATE_VISUAL_LAYOUT: CertificateVisualLayoutV2 = {
  version: 2,
  name: { xRatio: 0.19, yRatio: 0.405, widthRatio: 0.62, fontSize: 28, align: "center" },
  completionDate: { xRatio: 0.42, yRatio: 0.735, widthRatio: 0.22, fontSize: 11, align: "center" },
  certificateId: { xRatio: 0.035, yRatio: 0.93, widthRatio: 0.22, fontSize: 9, align: "left" },
};

export function parseCertificateVisualLayout(
  config: Record<string, unknown>,
): CertificateVisualLayoutV2 | null {
  const raw = config.visualLayout;
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== 2) return null;
  return {
    version: 2,
    name: parseField(record.name, DEFAULT_CERTIFICATE_VISUAL_LAYOUT.name),
    completionDate: parseField(record.completionDate, DEFAULT_CERTIFICATE_VISUAL_LAYOUT.completionDate),
    certificateId: parseField(record.certificateId, DEFAULT_CERTIFICATE_VISUAL_LAYOUT.certificateId),
  };
}

/** Browser/editor coordinates are normalized from the top-left.
 * pdf-lib coordinates are absolute from the bottom-left.
 */
export function resolveCertificateFieldPlacement(input: {
  field: CertificateFieldPlacement;
  pageWidth: number;
  pageHeight: number;
}): ResolvedCertificatePlacement {
  const { field, pageWidth, pageHeight } = input;
  const width = field.widthRatio * pageWidth;
  return {
    x: field.xRatio * pageWidth,
    y: pageHeight - field.yRatio * pageHeight,
    width,
    fontSize: field.fontSize,
    align: field.align,
  };
}

export function fitFontSizeToWidth(input: {
  text: string;
  preferredFontSize: number;
  maxWidth: number;
  measure: (text: string, size: number) => number;
  minimumFontSize?: number;
}): number {
  const minimum = Math.max(8, input.minimumFontSize ?? 12);
  let size = Math.max(minimum, input.preferredFontSize);
  while (size > minimum && input.measure(input.text, size) > input.maxWidth) {
    size -= 0.5;
  }
  return size;
}

export function alignedTextX(input: {
  placement: ResolvedCertificatePlacement;
  textWidth: number;
}): number {
  const { placement, textWidth } = input;
  if (placement.align === "right") return placement.x + placement.width - textWidth;
  if (placement.align === "center") return placement.x + (placement.width - textWidth) / 2;
  return placement.x;
}
