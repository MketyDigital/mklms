import { NextResponse } from "next/server";
import { z } from "zod";

import { getAccessRuntime } from "@/features/access/server/runtime";

const claimSchema = z
  .object({
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    certificateName: z.string().trim().min(2).max(160),
    certificateEmail: z.string().trim().email().optional().or(z.literal("")),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or phone is required.",
  });

const NEUTRAL_CLAIM_FAILURE = "We couldn't verify access with those details.";

export async function POST(request: Request) {
  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: NEUTRAL_CLAIM_FAILURE },
      { status: 400 },
    );
  }

  const { repository, accessService, settings } = await getAccessRuntime();
  const identity = {
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
  };
  const preauthorization = await repository.findPreauthorization(identity);

  if (!preauthorization) {
    return NextResponse.json(
      { ok: false, message: NEUTRAL_CLAIM_FAILURE },
      { status: 404 },
    );
  }

  const strategy =
    preauthorization.claimStrategy || settings.claimVerificationStrategy;

  if (strategy !== "preauth-only") {
    return NextResponse.json(
      {
        ok: false,
        verificationRequired: true,
        strategy,
        message:
          strategy === "manual-approval"
            ? "Your access request requires administrator approval."
            : "Additional verification is required before access can be issued.",
      },
      { status: 409 },
    );
  }

  const result = await accessService.completeVerifiedClaim({
    identity,
    certificateName: parsed.data.certificateName,
    certificateEmail: parsed.data.certificateEmail || parsed.data.email || null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.publicMessage },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    studentId: result.studentId,
    accessCode: result.accessCode,
    message:
      "Access created successfully. Save this access code securely; you will use it to enter the learning portal.",
  });
}
