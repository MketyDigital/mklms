import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PdfLibCertificateRenderer } from "@/features/certificates/providers/pdf-lib-certificate-renderer";
import { PostgresCertificateRepository } from "@/features/certificates/repositories/postgres-certificate.repository";
import { CertificateDeliveryService } from "@/features/certificates/services/certificate-delivery.service";
import { getConfiguredEmailProvider } from "@/providers/smtp-email-provider";
import { getConfiguredStorageProvider } from "@/providers/s3-compatible-storage-provider";

const actionSchema = z.object({
  action: z.enum(["revoke", "restore", "redeliver"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ certificateId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid certificate action." }, { status: 400 });
  }

  const { certificateId } = await context.params;
  const repository = new PostgresCertificateRepository();
  const certificate = await repository.findListItemById(certificateId);
  if (!certificate) {
    return NextResponse.json({ ok: false, message: "Certificate not found." }, { status: 404 });
  }

  if (parsed.data.action === "revoke") {
    await repository.revokeCertificate(certificate.id);
    return NextResponse.json({ ok: true, status: "REVOKED" });
  }

  if (parsed.data.action === "restore") {
    await repository.restoreCertificate(certificate.id);
    return NextResponse.json({ ok: true, status: "ISSUED" });
  }

  const issued = await repository.findByStudentCourse(
    certificate.studentId,
    certificate.courseId,
  );
  if (!issued || issued.status !== "ISSUED" || issued.revokedAt) {
    return NextResponse.json(
      { ok: false, message: "A revoked certificate cannot be delivered." },
      { status: 409 },
    );
  }

  const template = await repository.getActiveTemplate(certificate.courseId);
  if (!template) {
    return NextResponse.json(
      { ok: false, message: "No active certificate template is configured for this course." },
      { status: 409 },
    );
  }

  try {
    const storage = getConfiguredStorageProvider();
    const delivery = new CertificateDeliveryService({
      renderer: new PdfLibCertificateRenderer(storage),
      storage,
      email: getConfiguredEmailProvider(),
      repository,
    });
    const result = await delivery.deliver(issued, template);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Certificate delivery failed.",
      },
      { status: 503 },
    );
  }
}
