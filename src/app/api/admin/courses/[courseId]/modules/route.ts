import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { AdminLearningService } from "@/features/courses/services/admin-learning.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";

const schema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "A valid module title is required." }, { status: 400 });
  }

  const { courseId } = await context.params;
  const service = new AdminLearningService(new PostgresAdminLearningRepository());
  const module = await service.createModule(courseId, parsed.data);

  return NextResponse.json({ ok: true, module }, { status: 201 });
}
