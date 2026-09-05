import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { isAllowedZoomUrl } from "@/features/paid-live/domain/model";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  deliveryMode: z.enum(["MEDIA", "ZOOM"]),
  mediaAssetId: z.string().min(1).nullable().optional(),
  zoomUrl: z.string().trim().max(2048).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
}).superRefine((value, context) => {
  if (value.deliveryMode === "ZOOM" && value.zoomUrl && !isAllowedZoomUrl(value.zoomUrl)) {
    context.addIssue({ code: "custom", path: ["zoomUrl"], message: "Enter a valid HTTPS Zoom meeting or webinar link." });
  }
  if (value.status === "PUBLISHED" && value.deliveryMode === "MEDIA" && !value.mediaAssetId) {
    context.addIssue({ code: "custom", path: ["mediaAssetId"], message: "Select a ready video before publishing." });
  }
  if (value.status === "PUBLISHED" && value.deliveryMode === "ZOOM" && (!value.zoomUrl || !isAllowedZoomUrl(value.zoomUrl))) {
    context.addIssue({ code: "custom", path: ["zoomUrl"], message: "Add a valid Zoom link before publishing." });
  }
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
      deliveryMode: parsed.data.deliveryMode,
      mediaAssetId: parsed.data.mediaAssetId,
      zoomUrl: parsed.data.zoomUrl,
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
