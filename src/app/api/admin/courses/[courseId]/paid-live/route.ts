import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { isAllowedZoomUrl } from "@/features/paid-live/domain/model";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  deliveryMode: z.enum(["MEDIA", "ZOOM"]).default("MEDIA"),
  mediaAssetId: z.string().min(1).nullable().optional(),
  zoomUrl: z.string().trim().max(2048).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
}).superRefine((value, context) => {
  if (value.deliveryMode === "ZOOM" && value.zoomUrl && !isAllowedZoomUrl(value.zoomUrl)) {
    context.addIssue({ code: "custom", path: ["zoomUrl"], message: "Enter a valid HTTPS Zoom meeting or webinar link." });
  }
});

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid paid live session details." }, { status: 400 });
  const { courseId } = await params;
  try {
    const sessionId = await new PostgresPaidLiveRepository().createSession({
      courseId,
      title: parsed.data.title,
      description: parsed.data.description,
      deliveryMode: parsed.data.deliveryMode,
      mediaAssetId: parsed.data.mediaAssetId,
      zoomUrl: parsed.data.zoomUrl,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    });
    return NextResponse.json({ ok: true, sessionId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Could not create paid live session." }, { status: 400 });
  }
}
