import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { verifyDirectR2Object } from "@/features/media/server/r2-direct-upload";

const schema = z.object({
  title: z.string().trim().min(1).max(300),
  objectKey: z.string().min(1).max(500),
  durationSeconds: z.number().int().positive().nullable().optional(),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid uploaded media details." }, { status: 400 });
  }

  try {
    await verifyDirectR2Object(parsed.data.objectKey);
    const asset = await new PostgresAdminMediaRepository().createAsset({
      title: parsed.data.title,
      provider: "private-storage",
      sourceType: "DIRECT",
      providerAssetId: parsed.data.objectKey,
      durationSeconds: parsed.data.durationSeconds ?? null,
      status: "READY",
    });
    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not register the uploaded media." },
      { status: 400 },
    );
  }
}
