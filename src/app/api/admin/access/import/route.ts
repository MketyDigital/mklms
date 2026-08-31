import { NextResponse } from "next/server";
import { z } from "zod";

import { ACTIVE_CLAIM_VERIFICATION_STRATEGIES } from "@/features/access/domain/claim-verification";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { AccessAdminService } from "@/features/access/services/access-admin.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

const schema = z.object({
  mode: z.enum(["csv", "paste"]),
  content: z.string().min(1).max(2_000_000),
  courseId: z.string().max(160).optional(),
  claimStrategy: z.enum(ACTIVE_CLAIM_VERIFICATION_STRATEGIES),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid bulk authorization request." }, { status: 400 });

  const [settings, courses] = await Promise.all([
    new PostgresSettingsRepository().getPlatformSettings(),
    new PostgresAdminLearningRepository().listCourses(),
  ]);
  const service = new AccessAdminService(new PostgresAdminAccessRepository(), {
    accessCodePrefix: settings.accessCodePrefix,
    validCourseIds: new Set(courses.map((course) => course.id)),
  });

  const result = await service.bulkPreauthorize({
    mode: parsed.data.mode,
    content: parsed.data.content,
    courseId: parsed.data.courseId ?? null,
    claimStrategy: parsed.data.claimStrategy,
  });

  return NextResponse.json({ ok: true, ...result });
}
