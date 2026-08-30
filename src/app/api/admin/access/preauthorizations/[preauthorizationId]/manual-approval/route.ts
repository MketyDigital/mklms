import { NextResponse } from "next/server";

import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { AccessAdminService } from "@/features/access/services/access-admin.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ preauthorizationId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { preauthorizationId } = await context.params;
  const settings = await new PostgresSettingsRepository().getPlatformSettings();
  const service = new AccessAdminService(new PostgresAdminAccessRepository(), {
    accessCodePrefix: settings.accessCodePrefix,
  });

  try {
    await service.approveManualClaim(preauthorizationId);
    return NextResponse.json({
      ok: true,
      message: "Manual claim approved. The student can submit the claim form again to receive an access code.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The manual claim could not be approved.",
      },
      { status: 400 },
    );
  }
}
