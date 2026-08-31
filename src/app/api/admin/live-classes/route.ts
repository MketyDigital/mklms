import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminLiveClassRepository } from "@/features/live-classes/repositories/postgres-admin-live-class.repository";
import { AdminLiveClassService } from "@/features/live-classes/services/admin-live-class.service";

const optionalShortText = z.string().trim().max(500).optional().nullable();
const optionalUrl = z.string().trim().max(2048).optional().nullable();
const batchFields = {
  title: z.string().trim().min(1).max(200), slug: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(), expectedViewerBaseline: z.number().int().min(0).max(10_000_000).optional(),
  viewerDisplayMode: z.enum(["CONFIGURED_BASELINE", "ACTIVE_ONLY", "BASELINE_PLUS_ACTIVE"]).optional(), endedMessage: z.string().trim().max(5000).optional().nullable(),
  endedRedirectUrl: optionalUrl, notificationDestination: optionalShortText,
};
const sessionFields = {
  title: z.string().trim().min(1).max(200), position: z.number().int().min(1).max(3), startsAt: z.string().datetime(),
  durationSeconds: z.number().int().positive().max(12 * 60 * 60), mediaAssetId: z.string().trim().max(200).optional().nullable(),
  ctaText: optionalShortText, ctaUrl: optionalUrl, ctaRevealOffsetSeconds: z.number().int().min(0).max(12 * 60 * 60).optional().nullable(),
  endedMessage: z.string().trim().max(5000).optional().nullable(), endedRedirectUrl: optionalUrl,
};

const payloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createBatch"), ...batchFields }),
  z.object({ action: z.literal("updateBatch"), batchId: z.string().min(1).max(200), ...batchFields }),
  z.object({ action: z.literal("deleteBatch"), batchId: z.string().min(1).max(200) }),
  z.object({ action: z.literal("createSession"), batchId: z.string().min(1).max(200), ...sessionFields, status: z.enum(["DRAFT", "PUBLISHED"]).optional() }),
  z.object({ action: z.literal("updateSession"), sessionId: z.string().min(1).max(200), ...sessionFields }),
  z.object({ action: z.literal("deleteSession"), sessionId: z.string().min(1).max(200) }),
  z.object({ action: z.literal("importTimeline"), sessionId: z.string().min(1).max(200), format: z.enum(["csv", "text"]), content: z.string().max(2_000_000) }),
  z.object({ action: z.literal("setBatchStatus"), batchId: z.string().min(1).max(200), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) }),
  z.object({ action: z.literal("setSessionStatus"), sessionId: z.string().min(1).max(200), status: z.enum(["DRAFT", "PUBLISHED"]) }),
  z.object({ action: z.literal("testNow"), title: z.string().trim().max(200).optional(), expectedViewerBaseline: z.number().int().min(0).max(10_000_000).optional() }),
]);

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid live class request." }, { status: 400 });
  const repository = new PostgresAdminLiveClassRepository();
  const service = new AdminLiveClassService(repository);

  try {
    switch (parsed.data.action) {
      case "createBatch": return NextResponse.json({ ok: true, batch: await service.createBatch(parsed.data) });
      case "updateBatch": await service.updateBatch(parsed.data.batchId, parsed.data); return NextResponse.json({ ok: true });
      case "deleteBatch": await service.deleteBatch(parsed.data.batchId); return NextResponse.json({ ok: true });
      case "createSession": return NextResponse.json({ ok: true, session: await service.createSession(parsed.data.batchId, { ...parsed.data, startsAt: new Date(parsed.data.startsAt) }) });
      case "updateSession": await service.updateSession(parsed.data.sessionId, { ...parsed.data, startsAt: new Date(parsed.data.startsAt) }); return NextResponse.json({ ok: true });
      case "deleteSession": await service.deleteSession(parsed.data.sessionId); return NextResponse.json({ ok: true });
      case "importTimeline": return NextResponse.json({ ok: true, ...(await service.importTimeline(parsed.data.sessionId, parsed.data)) });
      case "setBatchStatus": await service.setBatchStatus(parsed.data.batchId, parsed.data.status); return NextResponse.json({ ok: true, status: parsed.data.status });
      case "setSessionStatus": await repository.setSessionStatus(parsed.data.sessionId, parsed.data.status); return NextResponse.json({ ok: true, status: parsed.data.status });
      case "testNow": return NextResponse.json({ ok: true, ...(await service.createQuickTest({ title: parsed.data.title, expectedViewerBaseline: parsed.data.expectedViewerBaseline })) }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Live class action failed." }, { status: 409 });
  }
}
