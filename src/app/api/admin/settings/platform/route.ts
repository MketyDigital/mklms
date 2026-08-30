import { NextResponse } from "next/server";
import { z } from "zod";

import { CLAIM_VERIFICATION_STRATEGIES } from "@/features/access/domain/claim-verification";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

const schema = z.object({
  organizationName: z.string().min(1).max(160),
  productName: z.string().min(1).max(160),
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().max(64).nullable().optional(),
  secondaryColor: z.string().max(64).nullable().optional(),
  supportName: z.string().max(160).nullable().optional(),
  supportEmail: z.string().email().nullable().optional(),
  publicBaseUrl: z.string().url(),
  timezone: z.string().min(1).max(80),
  locale: z.string().min(2).max(20),
  accessProvider: z.enum(["access-code", "password", "magic-link", "oidc", "custom"]),
  claimVerificationStrategy: z.enum(CLAIM_VERIFICATION_STRATEGIES),
  storageProvider: z.enum(["r2", "s3", "oci", "supabase", "minio", "custom"]),
  mediaProvider: z.enum(["generic-hls", "oci-media-flow", "youtube", "external-embed", "custom"]),
  emailProvider: z.enum(["smtp", "ses", "resend", "postmark", "sendgrid", "brevo", "custom", "none"]),
  notificationProvider: z.enum(["telegram", "email", "webhook", "custom", "none"]),
  accessCodePrefix: z.string().min(1).max(24),
  certificatePrefix: z.string().min(1).max(24),
});

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const settings = await new PostgresSettingsRepository().getPlatformSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid settings.",
      },
      { status: 400 },
    );
  }

  await new PostgresSettingsRepository().savePlatformSettings(parsed.data);
  return NextResponse.json({ ok: true, settings: parsed.data });
}
