import { NextResponse } from "next/server";
import { z } from "zod";

import { ACTIVE_CLAIM_VERIFICATION_STRATEGIES } from "@/features/access/domain/claim-verification";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { AccessAdminService } from "@/features/access/services/access-admin.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

const createSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).max(32).optional(),
  nameHint: z.string().max(160).optional(),
  courseId: z.string().max(160).optional(),
  claimStrategy: z.enum(ACTIVE_CLAIM_VERIFICATION_STRATEGIES),
  claimCode: z.string().max(160).optional(),
  externalReference: z.string().max(255).optional(),
}).refine((value) => Boolean(value.email || value.phone), {
  message: "Email or phone is required.",
});

export async function GET() {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, preauthorizations: await new PostgresAdminAccessRepository().listPreauthorizations(250) });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid approval." }, { status: 400 });

  const [settings, courses] = await Promise.all([
    new PostgresSettingsRepository().getPlatformSettings(),
    new PostgresAdminLearningRepository().listCourses(),
  ]);
  const service = new AccessAdminService(new PostgresAdminAccessRepository(), {
    accessCodePrefix: settings.accessCodePrefix,
    validCourseIds: new Set(courses.map((course) => course.id)),
  });

  try {
    const preauthorization = await service.preauthorize({ ...parsed.data, source: "manual" });
    return NextResponse.json({ ok: true, preauthorization }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not authorize student." }, { status: 400 });
  }
}
