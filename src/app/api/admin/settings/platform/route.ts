import { NextResponse } from "next/server";
import { z } from "zod";

import { ACTIVE_CLAIM_VERIFICATION_STRATEGIES } from "@/features/access/domain/claim-verification";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { DEFAULT_PORTAL_FONT_FAMILY, normalizePortalFontFamily } from "@/features/settings/font-branding";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

const httpsUrl = z.string().url().refine(
  (value) => value.toLowerCase().startsWith("https://"),
  "Graduate community URL must use HTTPS.",
);

const portalFont = z.string().min(1).max(80).refine(
  (value) => normalizePortalFontFamily(value) !== null,
  "Portal font must be a safe Google Font family name or supported system font.",
).optional().default(DEFAULT_PORTAL_FONT_FAMILY);

const schema = z.object({
  organizationName: z.string().min(1).max(160), productName: z.string().min(1).max(160),
  logoUrl: z.string().url().nullable().optional(), faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().max(64).nullable().optional(), secondaryColor: z.string().max(64).nullable().optional(),
  fontFamily: portalFont,
  supportName: z.string().max(160).nullable().optional(), supportEmail: z.string().email().nullable().optional(),
  publicBaseUrl: z.string().url(), timezone: z.string().min(1).max(80), locale: z.string().min(2).max(20),
  accessProvider: z.literal("access-code"),
  claimVerificationStrategy: z.enum(ACTIVE_CLAIM_VERIFICATION_STRATEGIES),
  storageProvider: z.enum(["r2", "s3", "supabase", "minio", "custom"]),
  mediaProvider: z.enum(["generic-hls", "youtube", "external-embed", "custom"]),
  emailProvider: z.enum(["smtp", "none"]), notificationProvider: z.enum(["telegram", "none"]),
  accessCodePrefix: z.string().min(1).max(24), certificatePrefix: z.string().min(1).max(24),
  completionCommunityUrl: httpsUrl.nullable().optional(),
});

export async function GET() {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, settings: await new PostgresSettingsRepository().getPlatformSettings() });
}

export async function PUT(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid settings." }, { status: 400 });
  const repository = new PostgresSettingsRepository();
  await repository.savePlatformSettings(parsed.data);
  return NextResponse.json({ ok: true, settings: await repository.getPlatformSettings() });
}
