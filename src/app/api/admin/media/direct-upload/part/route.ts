import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { consumeDistributedRateLimit, getRequestClientKey, rateLimitHeaders } from "@/lib/security/rate-limit";

import { createDirectR2MultipartPartAuthorization } from "@/features/media/server/r2-direct-upload";

const schema = z.object({
  objectKey: z.string().min(1).max(500),
  uploadId: z.string().min(1).max(2000),
  partNumber: z.number().int().min(1).max(10000),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const limit = await consumeDistributedRateLimit("ADMIN_RATE_LIMITER", getRequestClientKey(request, "admin-upload-part"));
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, message: "Too many upload requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limit) });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid multipart upload part." }, { status: 400 });
  }
  try {
    const authorization = await createDirectR2MultipartPartAuthorization(parsed.data);
    return NextResponse.json({ ok: true, uploadUrl: authorization.uploadUrl, expiresAt: authorization.expiresAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not authorize multipart upload part." }, { status: 503 });
  }
}
