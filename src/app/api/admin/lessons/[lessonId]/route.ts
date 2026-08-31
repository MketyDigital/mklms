import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { AdminLearningService } from "@/features/courses/services/admin-learning.service";

const updateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  mediaAssetId: z.string().max(255).nullable().optional(),
  completionMode: z.enum(["VIDEO_PROGRESS", "MANUAL", "CUSTOM"]).optional(),
  completionThresholdPercent: z.number().int().min(1).max(100).optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid lesson details." }, { status: 400 });
  const { lessonId } = await params;
  try {
    await new AdminLearningService(new PostgresAdminLearningRepository()).updateLesson(lessonId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not update lesson." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const { lessonId } = await params;
  try {
    await new AdminLearningService(new PostgresAdminLearningRepository()).deleteLesson(lessonId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not delete lesson." }, { status: 409 });
  }
}
