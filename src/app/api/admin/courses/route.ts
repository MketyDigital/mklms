import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { AdminLearningService } from "@/features/courses/services/admin-learning.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";

const createSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).optional(),
  slug: z.string().trim().max(180).optional(),
});

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const service = new AdminLearningService(new PostgresAdminLearningRepository());
  return NextResponse.json({ ok: true, courses: await service.listCourses() });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "A valid course title is required." },
      { status: 400 },
    );
  }

  try {
    const service = new AdminLearningService(new PostgresAdminLearningRepository());
    const course = await service.createCourse(parsed.data);
    return NextResponse.json({ ok: true, course }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Could not create course.",
      },
      { status: 400 },
    );
  }
}
