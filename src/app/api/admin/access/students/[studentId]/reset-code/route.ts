import { NextResponse } from "next/server";

import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { AccessAdminService } from "@/features/access/services/access-admin.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { studentId } = await context.params;
  const settings = await new PostgresSettingsRepository().getPlatformSettings();
  const service = new AccessAdminService(new PostgresAdminAccessRepository(), {
    accessCodePrefix: settings.accessCodePrefix,
  });

  const result = await service.resetStudentAccessCode(studentId);
  return NextResponse.json({
    ok: true,
    accessCode: result.accessCode,
    message: "A new access code was issued. The previous access code is no longer valid.",
  });
}
