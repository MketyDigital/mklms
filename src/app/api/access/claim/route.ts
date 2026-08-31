import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyClaimCode } from "@/features/access/domain/claim-code";
import { PostgresAccessRepository } from "@/features/access/repositories/postgres-access.repository";
import { AccessService } from "@/features/access/services/access.service";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

const claimSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).max(32).optional(),
  certificateName: z.string().min(2).max(160),
  certificateEmail: z.string().email().optional(),
  claimCode: z.string().max(160).optional(),
}).refine((value) => Boolean(value.email || value.phone), {
  message: "Email or phone is required.",
});

const NEUTRAL_FAILURE = "We couldn't verify access with those details.";

export async function POST(request: Request) {
  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: NEUTRAL_FAILURE },
      { status: 400 },
    );
  }

  const repository = new PostgresAccessRepository();
  const settingsRepository = new PostgresSettingsRepository();
  const identity = {
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
  };

  const preauthorization = await repository.findPreauthorization(identity);
  if (!preauthorization) {
    return NextResponse.json(
      { ok: false, message: NEUTRAL_FAILURE },
      { status: 403 },
    );
  }

  const settings = await settingsRepository.getPlatformSettings();
  const strategy =
    preauthorization.claimStrategy ?? settings.claimVerificationStrategy;

  if (strategy === "claim-code") {
    if (
      !parsed.data.claimCode ||
      !preauthorization.claimCodeHash ||
      !verifyClaimCode(parsed.data.claimCode, preauthorization.claimCodeHash)
    ) {
      return NextResponse.json(
        { ok: false, message: NEUTRAL_FAILURE },
        { status: 403 },
      );
    }
  } else if (strategy === "manual-approval") {
    if (!preauthorization.manualApprovedAt) {
      await repository.markPreauthorizationClaimRequested(preauthorization.id);
      return NextResponse.json(
        {
          ok: false,
          verificationRequired: true,
          strategy,
          message:
            "Your access request has been sent to the administrator. After approval, submit these same details again to receive your access code.",
        },
        { status: 202 },
      );
    }
  } else if (strategy !== "preauth-only") {
    return NextResponse.json(
      {
        ok: false,
        verificationRequired: true,
        strategy,
        message:
          "This portal uses an additional verification step before access can be claimed.",
      },
      { status: 202 },
    );
  }

  const service = new AccessService(repository, {
    accessCodePrefix: settings.accessCodePrefix,
  });
  const result = await service.completeVerifiedClaim({
    identity,
    certificateName: parsed.data.certificateName,
    certificateEmail: parsed.data.certificateEmail ?? parsed.data.email ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.publicMessage },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    studentId: result.studentId,
    accessCode: result.accessCode,
    message:
      "Your access has been created. Save this access code securely; you will use it to enter the learning portal.",
  });
}
