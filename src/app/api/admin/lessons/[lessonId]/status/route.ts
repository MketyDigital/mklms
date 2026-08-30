import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { AdminLearningService } from "@/features/courses/services/admin-learning.service";

const schema = z.object({ status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid lesson status." }, { status: 400 });
  }

  const { lessonId } = await context.params;
  const service = new AdminLearningService(new PostgresAdminLearningRepository());
  await service.setLessonStatus(lessonId, parsed.data.status);

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
