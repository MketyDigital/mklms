import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { getConfiguredStorageProvider } from "@/providers/s3-compatible-storage-provider";

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const title = String(formData?.get("title") ?? "").trim();
  const durationRaw = String(formData?.get("durationSeconds") ?? "").trim();
  const durationSeconds = durationRaw ? Number(durationRaw) : null;

  if (!(file instanceof File) || !title) {
    return NextResponse.json(
      { ok: false, message: "A title and MP4 file are required." },
      { status: 400 },
    );
  }

  if (file.type !== "video/mp4" || !file.name.toLowerCase().endsWith(".mp4")) {
    return NextResponse.json(
      { ok: false, message: "Only MP4 video files are supported." },
      { status: 400 },
    );
  }

  if (
    durationSeconds !== null &&
    (!Number.isInteger(durationSeconds) || durationSeconds <= 0)
  ) {
    return NextResponse.json(
      { ok: false, message: "Duration must be a positive whole number of seconds." },
      { status: 400 },
    );
  }

  const storage = getConfiguredStorageProvider();
  const key = `media/${randomUUID()}.mp4`;
  const stored = await storage.putObject({
    key,
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: "video/mp4",
    visibility: "private",
  });

  try {
    const asset = await new PostgresAdminMediaRepository().createAsset({
      title,
      provider: "private-storage",
      sourceType: "DIRECT",
      providerAssetId: stored.assetId,
      durationSeconds,
      status: "READY",
    });

    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    if (storage.deleteObject) {
      await storage.deleteObject(stored.assetId).catch(() => undefined);
    }
    throw error;
  }
}
