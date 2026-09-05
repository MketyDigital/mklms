import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  mediaAssetId: z.string().min(1).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid paid live session details." }, { status: 400 });
  const { sessionId } = await params;
  try {
    await new PostgresPaidLiveRepository().updateSession(sessionId, {
      title: parsed.data.title,
      description: parsed.data.description,
      mediaAssetId: parsed.data.mediaAssetId,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      status: parsed.data.status,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not update paid live session." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const { sessionId } = await params;
  try {
    await new PostgresPaidLiveRepository().deleteSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not delete paid live session." }, { status: 409 });
  }
}
