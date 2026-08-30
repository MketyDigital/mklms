import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";

const createSchema = z.object({
  title: z.string().trim().min(1),
  provider: z.string().trim().min(1).default("custom"),
  sourceType: z.enum(["HLS", "DIRECT", "YOUTUBE", "EXTERNAL_EMBED", "CUSTOM"]),
  providerAssetId: z.string().trim().min(1),
  durationSeconds: z.number().int().positive().nullable().optional(),
  status: z.enum(["PENDING", "PROCESSING", "READY", "FAILED"]).optional(),
});

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const assets = await new PostgresAdminMediaRepository().listAssets();
  return NextResponse.json({ ok: true, assets });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid media asset details." }, { status: 400 });
  }

  const asset = await new PostgresAdminMediaRepository().createAsset(parsed.data);
  return NextResponse.json({ ok: true, asset }, { status: 201 });
}
