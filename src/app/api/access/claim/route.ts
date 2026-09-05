import { NextResponse } from "next/server";
import { z } from "zod";

import { ACTIVE_CLAIM_VERIFICATION_STRATEGIES } from "@/features/access/domain/claim-verification";
import { verifyClaimCode } from "@/features/access/domain/claim-code";
import { PostgresAccessRepository } from "@/features/access/repositories/postgres-access.repository";
import { AccessService } from "@/features/access/services/access.service";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import { consumeDistributedRateLimit, getRequestClientKey, rateLimitHeaders } from "@/lib/security/rate-limit";

const claimSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).max(32).optional(),
  certificateName: z.string().min(2).max(160),
  certificateEmail: z.string().email().optional(),
  claimCode: z.string().max(160).optional(),
}).refine((value) => Boolean(value.email || value.phone), { message: "Email or phone is required." });

const NEUTRAL_FAILURE = "We couldn't verify access with those details.";
const SERVICE_FAILURE = "Access could not be created right now. Please retry. If it continues, ask the administrator to cancel the pending authorization and create it again.";

export async function POST(request: Request) {
  const limit = await consumeDistributedRateLimit(
    "AUTH_RATE_LIMITER",
    getRequestClientKey(request, "student-claim"),
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many access requests. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: NEUTRAL_FAILURE }, { status: 400 });

  try {
    const repository = new PostgresAccessRepository();
    const identity = { email: parsed.data.email ?? null, phone: parsed.data.phone ?? null };
    const preauthorization = await repository.findPreauthorization(identity);
    if (!preauthorization) return NextResponse.json({ ok: false, message: NEUTRAL_FAILURE }, { status: 403 });

    const settings = await new PostgresSettingsRepository().getPlatformSettings();
    const strategy = preauthorization.claimStrategy ?? settings.claimVerificationStrategy;
    if (!ACTIVE_CLAIM_VERIFICATION_STRATEGIES.includes(strategy as (typeof ACTIVE_CLAIM_VERIFICATION_STRATEGIES)[number])) {
      return NextResponse.json({
        ok: false,
        message: "This pending authorization uses an old verification method that is no longer active. Ask the administrator to cancel it and create a new authorization.",
      }, { status: 409 });
    }

    if (strategy === "claim-code") {
      if (!parsed.data.claimCode || !preauthorization.claimCodeHash || !verifyClaimCode(parsed.data.claimCode, preauthorization.claimCodeHash)) {
        return NextResponse.json({ ok: false, message: NEUTRAL_FAILURE }, { status: 403 });
      }
    } else if (strategy === "manual-approval" && !preauthorization.manualApprovedAt) {
      await repository.markPreauthorizationClaimRequested(preauthorization.id);
      return NextResponse.json({
        ok: false,
        verificationRequired: true,
        strategy,
        message: "Your access request has been sent to the administrator. After approval, submit these same details again to receive your sign-in access code.",
      }, { status: 202 });
    }

    const result = await new AccessService(repository, { accessCodePrefix: settings.accessCodePrefix }).completeVerifiedClaim({
      identity,
      certificateName: parsed.data.certificateName,
      certificateEmail: parsed.data.certificateEmail ?? parsed.data.email ?? null,
    });
    if (!result.ok) return NextResponse.json({ ok: false, message: result.publicMessage }, { status: 403 });

    return NextResponse.json({
      ok: true,
      studentId: result.studentId,
      accessCode: result.accessCode,
      message: "Your access has been created. Save this sign-in access code securely; you will use it to enter the learning portal.",
    });
  } catch (error) {
    console.error("MkLMS access claim failed", error);
    return NextResponse.json({ ok: false, message: SERVICE_FAILURE }, { status: 503 });
  }
}
