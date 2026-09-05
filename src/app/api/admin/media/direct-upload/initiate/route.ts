import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { getManagedHostingServiceAccess } from "@/features/hosting/server/managed-hosting-access";
import { createDirectR2UploadAuthorization } from "@/features/media/server/r2-direct-upload";

const schema = z.object({
  title: z.string().trim().min(1).max(300),
  contentType: z.literal("video/mp4"),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().int().positive().nullable().optional(),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const hostingAccess = await getManagedHostingServiceAccess();
  if (!hostingAccess.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "HOSTING_PAYMENT_REQUIRED",
        message: "New hosted-video uploads are temporarily restricted because a managed hosting payment is overdue. Payment confirmation restores uploads automatically.",
      },
      { status: 402 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid MP4 upload details." }, { status: 400 });
  }

  try {
    const authorization = await createDirectR2UploadAuthorization({
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json({
      ok: true,
      uploadUrl: authorization.uploadUrl,
      objectKey: authorization.objectKey,
      expiresAt: authorization.expiresAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not authorize the R2 upload." },
      { status: 503 },
    );
  }
}
