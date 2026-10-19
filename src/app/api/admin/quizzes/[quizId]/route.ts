import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { createPostgresQuizRepository } from "@/features/quizzes/repositories/quiz-repository.factory";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  passMarkPercent: z.number().int().min(1).max(100),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid quiz details." }, { status: 400 });
  const { quizId } = await params;
  try {
    await createPostgresQuizRepository().updateQuiz(quizId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not update quiz." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const { quizId } = await params;
  try {
    await createPostgresQuizRepository().deleteQuiz(quizId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not delete quiz." }, { status: 409 });
  }
}
