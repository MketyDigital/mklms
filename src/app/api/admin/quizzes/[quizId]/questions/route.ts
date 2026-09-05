import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresQuizRepository } from "@/features/quizzes/repositories/postgres-quiz.repository";

const schema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  choices: z.array(z.string().trim().min(1).max(1000)).min(2).max(8),
  correctChoiceIndex: z.number().int().min(0),
});

export async function POST(request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.correctChoiceIndex >= parsed.data.choices.length) {
    return NextResponse.json({ ok: false, message: "Invalid quiz question." }, { status: 400 });
  }
  const { quizId } = await params;
  try {
    const questionId = await new PostgresQuizRepository().addQuestion({ quizId, ...parsed.data });
    return NextResponse.json({ ok: true, questionId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not add question." }, { status: 400 });
  }
}
