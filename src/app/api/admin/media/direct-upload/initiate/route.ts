import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { getManagedHostingServiceAccess } from "@/features/hosting/server/managed-hosting-access";
import { createDirectR2UploadAuthorization } from "@/features/media/server/r2-direct-upload";
import { consumeDistributedRateLimit, getRequestClientKey, rateLimitHeaders } from "@/lib/security/rate-limit";

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

  const limit = await consumeDistributedRateLimit(
    "ADMIN_RATE_LIMITER",
    getRequestClientKey(request, "admin-upload-initiate"),
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many upload requests. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
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
    if (authorization.mode === "single") {
      return NextResponse.json({
        ok: true,
        mode: "single",
        uploadUrl: authorization.uploadUrl,
        objectKey: authorization.objectKey,
        expiresAt: authorization.expiresAt.toISOString(),
      });
    }
    return NextResponse.json({
      ok: true,
      mode: "multipart",
      uploadId: authorization.uploadId,
      objectKey: authorization.objectKey,
      partSizeBytes: authorization.partSizeBytes,
    });
  } catch (error) {
    const requestId = request.headers.get("cf-ray")?.trim() || crypto.randomUUID();
    const rawErrorName = error instanceof Error ? error.name : "UnknownError";
    const errorName = /^[A-Za-z0-9_-]{1,80}$/.test(rawErrorName) ? rawErrorName : "UnknownError";
    const errorMessage = error instanceof Error ? error.message : "Unknown upload preparation failure";
    console.error("Streaming Storage upload session creation failed", { requestId, errorName, errorMessage });
    return NextResponse.json(
      {
        ok: false,
        code: "UPLOAD_SESSION_FAILED",
        detailCode: errorName,
        requestId,
        message: "Streaming Storage could not start an upload session. Please try again shortly.",
      },
      { status: 503 },
    );
  }
}
