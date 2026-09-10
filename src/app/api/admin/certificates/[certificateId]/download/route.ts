import { NextResponse } from "next/server";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresCertificateRepository } from "@/features/certificates/repositories/postgres-certificate.repository";
import { getConfiguredStorageProvider } from "@/providers/s3-compatible-storage-provider";

function safeCertificateFilename(certificateId: string): string {
  const safeId = certificateId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `certificate-${safeId || "issued"}.pdf`;
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ certificateId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const { certificateId } = await context.params;
  const certificate = await new PostgresCertificateRepository().findListItemById(certificateId);
  if (!certificate?.pdfAssetId) {
    return NextResponse.json(
      { ok: false, message: "Certificate PDF is not available." },
      { status: 404 },
    );
  }

  try {
    const storage = getConfiguredStorageProvider();
    if (!storage.getObject) {
      return NextResponse.json(
        { ok: false, message: "Certificate download is unavailable." },
        { status: 503 },
      );
    }

    const stored = await storage.getObject(certificate.pdfAssetId);
    const disposition =
      new URL(request.url).searchParams.get("disposition") === "inline"
        ? "inline"
        : "attachment";

    return new Response(copyToArrayBuffer(stored.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${safeCertificateFilename(certificate.certificateId)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Certificate download is unavailable." },
      { status: 503 },
    );
  }
}
