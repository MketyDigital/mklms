import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { getConfiguredStorageProvider } from "@/providers/s3-compatible-storage-provider";

const registerSchema = z.object({
  assetId: z.string().min(1).max(2048),
  title: z.string().min(1).max(200),
  durationSeconds: z.number().int().positive().nullable().optional(),
});

function getSourceType(assetId: string): "DIRECT" | "HLS" | null {
  const normalized = assetId.toLowerCase().split("?")[0];
  if (normalized.endsWith(".mp4")) return "DIRECT";
  if (normalized.endsWith(".m3u8")) return "HLS";
  return null;
}

function isApplicationObject(assetId: string): boolean {
  const key = assetId.replace(/^\/+/, "").toLowerCase();
  return key.startsWith("certificates/") || key.startsWith("app/");
}

function suggestedTitle(assetId: string): string {
  const file = assetId.split("/").filter(Boolean).at(-1) ?? assetId;
  let readable = file;
  try {
    readable = decodeURIComponent(file);
  } catch {
    readable = file;
  }
  return readable
    .replace(/\.(mp4|m3u8)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "Private media";
}

export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const storage = getConfiguredStorageProvider();
  if (!storage.listObjects) {
    return NextResponse.json(
      { ok: false, message: "This storage adapter does not support media browsing." },
      { status: 501 },
    );
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || undefined;
  const listed = await storage.listObjects({ cursor, limit: 500 });
  const registeredAssets = await new PostgresAdminMediaRepository().listAssets();
  const registered = new Set(
    registeredAssets
      .map((asset) => asset.providerAssetId?.trim())
      .filter((assetId): assetId is string => Boolean(assetId)),
  );

  const objects = listed.objects
    .map((object) => ({ ...object, sourceType: getSourceType(object.assetId) }))
    .filter((object) => object.sourceType && !isApplicationObject(object.assetId))
    .map((object) => ({
      assetId: object.assetId,
      title: suggestedTitle(object.assetId),
      sourceType: object.sourceType,
      size: object.size ?? null,
      uploadedAt: object.uploadedAt?.toISOString() ?? null,
      registered: registered.has(object.assetId),
    }));

  return NextResponse.json({
    ok: true,
    objects,
    cursor: listed.cursor ?? null,
    truncated: listed.truncated,
  });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid private media record." }, { status: 400 });
  }

  const sourceType = getSourceType(parsed.data.assetId);
  if (!sourceType || isApplicationObject(parsed.data.assetId)) {
    return NextResponse.json({ ok: false, message: "Only private MP4 or HLS playlist files can be registered here." }, { status: 400 });
  }

  const repository = new PostgresAdminMediaRepository();
  const existing = (await repository.listAssets()).find(
    (asset) => asset.providerAssetId === parsed.data.assetId,
  );
  if (existing) {
    return NextResponse.json({ ok: true, asset: existing, alreadyRegistered: true });
  }

  const asset = await repository.createAsset({
    title: parsed.data.title,
    provider: "private-storage",
    sourceType,
    providerAssetId: parsed.data.assetId,
    durationSeconds: parsed.data.durationSeconds ?? null,
    status: "READY",
  });

  return NextResponse.json({ ok: true, asset, alreadyRegistered: false });
}
