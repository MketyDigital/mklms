import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { AdminLearningService } from "@/features/courses/services/admin-learning.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";

const schema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).optional(),
  mediaAssetId: z.string().trim().max(255).optional(),
  completionMode: z.enum(["MANUAL", "VIDEO_PROGRESS", "CUSTOM"]).optional(),
  completionThresholdPercent: z.number().int().min(1).max(100).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ moduleId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid lesson details." }, { status: 400 });
  }

  const { moduleId } = await context.params;
  const service = new AdminLearningService(new PostgresAdminLearningRepository());
  const lesson = await service.createLesson(moduleId, parsed.data);

  return NextResponse.json({ ok: true, lesson }, { status: 201 });
}
