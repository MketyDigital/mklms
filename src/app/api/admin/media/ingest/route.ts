import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import {
  conservativeLiveClassProfile,
  estimateOciMediaFlowStandardH264Cost,
} from "@/features/media/domain/oci-media-flow-cost";
import { PostgresMediaIngestRepository } from "@/features/media/repositories/postgres-media-ingest.repository";

const estimateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  durationMinutes: z.number().positive().max(24 * 60),
});

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const jobs = await new PostgresMediaIngestRepository().listJobs();
  return NextResponse.json({ ok: true, jobs });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const parsed = estimateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Enter a valid title and duration." }, { status: 400 });
  }

  const estimate = estimateOciMediaFlowStandardH264Cost({
    durationMinutes: parsed.data.durationMinutes,
    outputs: conservativeLiveClassProfile(),
  });
  const job = await new PostgresMediaIngestRepository().createEstimate({
    title: parsed.data.title,
    durationMinutes: parsed.data.durationMinutes,
    estimatedCostUsd: estimate.usd,
  });

  return NextResponse.json({ ok: true, job, estimate }, { status: 201 });
}
