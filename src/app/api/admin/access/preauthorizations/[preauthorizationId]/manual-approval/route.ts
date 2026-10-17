import { NextResponse } from "next/server";

import { createPostgresAdminAccessRepository } from "@/features/access/repositories/access-repository.factory";
import { AccessAdminService } from "@/features/access/services/access-admin.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { createPostgresSettingsRepository } from "@/features/settings/repositories/settings-repository.factory";

export async function POST(
  _request: Request,
  context: { params: Promise<{ preauthorizationId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { preauthorizationId } = await context.params;
  const settings = await createPostgresSettingsRepository().getPlatformSettings();
  const service = new AccessAdminService(createPostgresAdminAccessRepository(), {
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
