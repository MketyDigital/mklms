import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminLiveClassRepository } from "@/features/live-classes/repositories/postgres-admin-live-class.repository";
import { AdminLiveClassService } from "@/features/live-classes/services/admin-live-class.service";

const createBatchSchema = z.object({
  action: z.literal("createBatch"),
  title: z.string(),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  expectedViewerBaseline: z.number().int().min(0).optional(),
  viewerDisplayMode: z.enum(["CONFIGURED_BASELINE", "ACTIVE_ONLY", "BASELINE_PLUS_ACTIVE"]).optional(),
  endedMessage: z.string().optional().nullable(),
  endedRedirectUrl: z.string().optional().nullable(),
  notificationDestination: z.string().optional().nullable(),
});

const createSessionSchema = z.object({
  action: z.literal("createSession"),
  batchId: z.string().min(1),
  title: z.string(),
  position: z.number().int().min(1).max(3),
  startsAt: z.string().datetime(),
  durationSeconds: z.number().int().positive(),
  mediaAssetId: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  ctaText: z.string().optional().nullable(),
  ctaUrl: z.string().optional().nullable(),
  ctaRevealOffsetSeconds: z.number().int().min(0).optional().nullable(),
  endedMessage: z.string().optional().nullable(),
  endedRedirectUrl: z.string().optional().nullable(),
});

const timelineSchema = z.object({
  action: z.literal("importTimeline"),
  sessionId: z.string().min(1),
  format: z.enum(["csv", "text"]),
  content: z.string(),
});

const batchStatusSchema = z.object({
  action: z.literal("setBatchStatus"),
  batchId: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
});

const sessionStatusSchema = z.object({
  action: z.literal("setSessionStatus"),
  sessionId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

const payloadSchema = z.discriminatedUnion("action", [
  createBatchSchema,
  createSessionSchema,
  timelineSchema,
  batchStatusSchema,
  sessionStatusSchema,
]);

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid live class request." }, { status: 400 });
  }

  const repository = new PostgresAdminLiveClassRepository();
  const service = new AdminLiveClassService(repository);

  try {
    switch (parsed.data.action) {
      case "createBatch": {
        const batch = await service.createBatch(parsed.data);
        return NextResponse.json({ ok: true, batch });
      }
      case "createSession": {
        const session = await service.createSession(parsed.data.batchId, {
          ...parsed.data,
          startsAt: new Date(parsed.data.startsAt),
        });
        return NextResponse.json({ ok: true, session });
      }
      case "importTimeline": {
        const result = await service.importTimeline(parsed.data.sessionId, parsed.data);
        return NextResponse.json({ ok: true, ...result });
      }
      case "setBatchStatus": {
        await service.setBatchStatus(parsed.data.batchId, parsed.data.status);
        return NextResponse.json({ ok: true, status: parsed.data.status });
      }
      case "setSessionStatus": {
        await repository.setSessionStatus(parsed.data.sessionId, parsed.data.status);
        return NextResponse.json({ ok: true, status: parsed.data.status });
      }
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Live class action failed." },
      { status: 409 },
    );
  }
}
