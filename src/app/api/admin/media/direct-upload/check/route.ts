import { NextResponse } from "next/server";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { runDirectMultipartStorageDiagnostic } from "@/features/media/server/direct-upload-diagnostic";
import { consumeDistributedRateLimit, getRequestClientKey, rateLimitHeaders } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const limit = await consumeDistributedRateLimit(
    "ADMIN_RATE_LIMITER",
    getRequestClientKey(request, "admin-upload-check"),
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many storage checks. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const result = await runDirectMultipartStorageDiagnostic();
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    {
      ok: false,
      stage: result.stage,
      detailCode: result.detailCode,
      httpStatusCode: result.httpStatusCode,
      reference: result.storageRequestId ?? request.headers.get("cf-ray")?.trim() ?? null,
    },
    { status: 503 },
  );
}
