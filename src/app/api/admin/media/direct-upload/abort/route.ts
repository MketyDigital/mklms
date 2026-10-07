import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { consumeDistributedRateLimit, getRequestClientKey, rateLimitHeaders } from "@/lib/security/rate-limit";

import { abortDirectR2MultipartUpload } from "@/features/media/server/r2-direct-upload";

const schema = z.object({
  objectKey: z.string().min(1).max(500),
  uploadId: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid multipart upload reference." }, { status: 400 });
  }
  try {
    await abortDirectR2MultipartUpload(parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not cancel multipart upload." }, { status: 400 });
  }
}
