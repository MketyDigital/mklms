import { NextResponse } from "next/server";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresCertificateRepository } from "@/features/certificates/repositories/postgres-certificate.repository";
import { getConfiguredStorageProvider } from "@/providers/s3-compatible-storage-provider";

export async function GET(
  _request: Request,
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
    if (!storage.createReadAuthorization) {
      return NextResponse.json(
        { ok: false, message: "Certificate download is unavailable." },
        { status: 503 },
      );
    }
    const authorization = await storage.createReadAuthorization(certificate.pdfAssetId, {
      ttlSeconds: 120,
    });
    return NextResponse.redirect(authorization.url, { status: 307 });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Certificate download is unavailable." },
      { status: 503 },
    );
  }
}
