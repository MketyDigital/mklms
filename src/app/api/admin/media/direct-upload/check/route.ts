import { NextResponse } from "next/server";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { runDirectMultipartStorageDiagnostic } from "@/features/media/server/direct-upload-diagnostic";

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
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
