import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresQuizRepository } from "@/features/quizzes/repositories/postgres-quiz.repository";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  passMarkPercent: z.number().int().min(1).max(100).default(70),
});

export async function POST(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid quiz details." }, { status: 400 });
  const { moduleId } = await params;
  try {
    const quizId = await new PostgresQuizRepository().createQuiz({ moduleId, ...parsed.data });
    return NextResponse.json({ ok: true, quizId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not create quiz." }, { status: 400 });
  }
}
