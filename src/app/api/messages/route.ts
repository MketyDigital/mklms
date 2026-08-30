import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresMessageRepository } from "@/features/messages/repositories/postgres-message.repository";

const sendSchema = z.object({ text: z.string().trim().min(1).max(5000) });

export async function GET() {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const messages = await new PostgresMessageRepository().listStudentMessages(
    session.studentId,
  );
  return NextResponse.json({ ok: true, messages }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Message cannot be empty." }, { status: 400 });
  }

  const message = await new PostgresMessageRepository().sendStudentMessage(
    session.studentId,
    session.displayName,
    parsed.data.text,
  );
  return NextResponse.json({ ok: true, message }, { status: 201 });
}
