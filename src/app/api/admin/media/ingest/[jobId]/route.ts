import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { nextMediaIngestState, type MediaIngestState } from "@/features/media/domain/media-ingest";
import { PostgresMediaIngestRepository } from "@/features/media/repositories/postgres-media-ingest.repository";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACCEPT_COST") }),
  z.object({
    action: z.literal("SET_STATE"),
    state: z.enum(["SOURCE_UPLOADED", "TRANSCODING", "TRANSCODED", "COPYING_TO_R2", "VERIFYING", "READY", "FAILED"]),
    sourceObjectKey: z.string().trim().max(1000).nullable().optional(),
    ociJobId: z.string().trim().max(1000).nullable().optional(),
    ociOutputPrefix: z.string().trim().max(1000).nullable().optional(),
    r2Prefix: z.string().trim().max(1000).nullable().optional(),
    r2MasterManifest: z.string().trim().max(1000).nullable().optional(),
    errorMessage: z.string().trim().max(4000).nullable().optional(),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const { jobId } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid ingest update." }, { status: 400 });
  }
  const repository = new PostgresMediaIngestRepository();
  const current = await repository.getJob(jobId);
  if (!current) {
    return NextResponse.json({ ok: false, message: "Ingest job not found." }, { status: 404 });
  }

  if (parsed.data.action === "ACCEPT_COST") {
    const job = await repository.acceptCost(jobId);
    return NextResponse.json({ ok: true, job });
  }

  if (parsed.data.state === "TRANSCODING" && !current.costAcceptedAt) {
    return NextResponse.json(
      { ok: false, message: "Accept the Media Flow estimate before starting a paid transcode." },
      { status: 409 },
    );
  }
  if (
    parsed.data.state === "READY" &&
    !(parsed.data.r2MasterManifest?.trim() || current.r2MasterManifest?.trim())
  ) {
    return NextResponse.json(
      { ok: false, message: "R2 master manifest is required before media can be marked READY." },
      { status: 409 },
    );
  }

  let state: MediaIngestState;
  try {
    state = nextMediaIngestState(current.state, parsed.data.state);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Invalid ingest transition." },
      { status: 409 },
    );
  }
  const job = await repository.updateManualStatus({
    id: jobId,
    state,
    sourceObjectKey: parsed.data.sourceObjectKey,
    ociJobId: parsed.data.ociJobId,
    ociOutputPrefix: parsed.data.ociOutputPrefix,
    r2Prefix: parsed.data.r2Prefix,
    r2MasterManifest: parsed.data.r2MasterManifest,
    errorMessage: parsed.data.errorMessage,
  });
  return NextResponse.json({ ok: true, job });
}
