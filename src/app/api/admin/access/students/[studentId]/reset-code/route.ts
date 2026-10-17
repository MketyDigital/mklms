import { NextResponse } from "next/server";

import { createPostgresAdminAccessRepository } from "@/features/access/repositories/access-repository.factory";
import { AccessAdminService } from "@/features/access/services/access-admin.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { createPostgresSettingsRepository } from "@/features/settings/repositories/settings-repository.factory";

export async function POST(
  _request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { studentId } = await context.params;
  const settings = await createPostgresSettingsRepository().getPlatformSettings();
  const service = new AccessAdminService(createPostgresAdminAccessRepository(), {
    accessCodePrefix: settings.accessCodePrefix,
  });

  const result = await service.resetStudentAccessCode(studentId);
  return NextResponse.json({
    ok: true,
    accessCode: result.accessCode,
    message: "A new access code was issued. The previous access code is no longer valid.",
  });
}
