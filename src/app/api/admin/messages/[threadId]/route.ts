import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresMessageRepository } from "@/features/messages/repositories/postgres-message.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

const sendSchema = z.object({ text: z.string().trim().min(1).max(5000) });

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const { threadId } = await context.params;
  const repository = new PostgresMessageRepository();
  if (!(await repository.getStudentIdForThread(threadId))) {
    return NextResponse.json({ ok: false, message: "Conversation not found." }, { status: 404 });
  }

  await repository.markThreadRead(threadId);
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Message cannot be empty." }, { status: 400 });
  }

  const { threadId } = await context.params;
  const repository = new PostgresMessageRepository();
  if (!(await repository.getStudentIdForThread(threadId))) {
    return NextResponse.json({ ok: false, message: "Conversation not found." }, { status: 404 });
  }

  const settings = await new PostgresSettingsRepository().getPlatformSettings();
  const message = await repository.sendAdminReply(
    threadId,
    settings.supportName ?? settings.organizationName,
    parsed.data.text,
  );

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
