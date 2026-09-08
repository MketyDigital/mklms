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

  try {
    const settings = await new PostgresSettingsRepository().getPlatformSettings();
    const service = new AccessAdminService(new PostgresAdminAccessRepository(), {
      accessCodePrefix: settings.accessCodePrefix,
      claimCodePrefix: "CLAIM",
    });
    const result = await service.prepareStudentReclaim(
      studentId,
      settings.claimVerificationStrategy,
    );

    return NextResponse.json({
      ok: true,
      claimCode: result.claimCode,
      onboardingPath: "/onboarding",
      message: result.claimCode
        ? "Reclaim prepared. Copy the one-time claim code now, then send the student to /onboarding. Their previous sign-in code and sessions are no longer valid."
        : "Reclaim prepared. Send the student to /onboarding with their approved identity. Their previous sign-in code and sessions are no longer valid.",
    });
  } catch (error) {
    console.error("MkLMS student reclaim preparation failed", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not prepare student reclaim.",
      },
      { status: 409 },
    );
  }
}
