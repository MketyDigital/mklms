import { NextResponse } from "next/server";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresCertificateTemplateRepository } from "@/features/certificates/repositories/postgres-certificate-template.repository";
import { getConfiguredStorageProvider } from "@/providers/s3-compatible-storage-provider";

const MAX_TEMPLATE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

function numberField(form: FormData, key: string): number | undefined {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const courseId = String(form.get("courseId") ?? "").trim() || null;
  const file = form.get("file");

  if (!name) {
    return NextResponse.json({ ok: false, message: "Template name is required." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, message: "Choose a PDF, PNG, or JPEG template." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_TEMPLATE_BYTES) {
    return NextResponse.json(
      { ok: false, message: "Template must be PDF, PNG, or JPEG and no larger than 15 MB." },
      { status: 400 },
    );
  }

  try {
    const storage = getConfiguredStorageProvider();
    const safeExtension =
      file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const key = `certificate-templates/${crypto.randomUUID()}.${safeExtension}`;
    const stored = await storage.putObject({
      key,
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      visibility: "private",
    });

    const layoutConfig: Record<string, number> = {};
    for (const keyName of [
      "nameX",
      "nameY",
      "nameFontSize",
      "dateX",
      "dateY",
      "dateFontSize",
      "idX",
      "idY",
      "idFontSize",
    ]) {
      const value = numberField(form, keyName);
      if (value !== undefined) layoutConfig[keyName] = value;
    }

    const id = await new PostgresCertificateTemplateRepository().createTemplate({
      name,
      courseId,
      backgroundAssetId: stored.assetId,
      layoutConfig,
      certificatePrefix: String(form.get("certificatePrefix") ?? "").trim() || "CERT",
      active: true,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Template upload failed.",
      },
      { status: 503 },
    );
  }
}
