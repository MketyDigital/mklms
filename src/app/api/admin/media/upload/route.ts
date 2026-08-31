import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import {
  ADMIN_MEDIA_UPLOAD_CHUNK_BYTES,
  createMediaUploadKey,
  validateAdminMediaUpload,
  validateMediaUploadKey,
} from "@/features/media/domain/admin-media-upload";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { getAdminMediaStorageProvider } from "@/features/media/server/admin-media-storage";

const uploadIdSchema = z.string().trim().min(1).max(1024);
const titleSchema = z.string().trim().min(1).max(200);
const partSchema = z.object({
  partNumber: z.number().int().min(1).max(10000),
  etag: z.string().trim().min(1).max(2048),
});

const createSchema = z.object({
  action: z.literal("create"),
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(128),
  sizeBytes: z.number().int().positive(),
});

const completeSchema = z.object({
  action: z.literal("complete"),
  key: z.string().trim().min(1),
  uploadId: uploadIdSchema,
  parts: z.array(partSchema).min(1).max(10000),
  title: titleSchema,
  durationSeconds: z.number().int().positive().nullable().optional(),
});

const abortSchema = z.object({
  action: z.literal("abort"),
  key: z.string().trim().min(1),
  uploadId: uploadIdSchema,
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

async function requireAdmin() {
  return hasValidAdminSession();
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized.", 401);

  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : null;
  const storage = getAdminMediaStorageProvider();

  try {
    if (action === "create") {
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid upload request.", 400);
      const upload = validateAdminMediaUpload(parsed.data);
      const key = createMediaUploadKey(upload.filename);
      const created = await storage.createMultipartUpload({
        key,
        contentType: upload.contentType,
        visibility: "private",
      });
      return NextResponse.json({
        ok: true,
        key: created.key,
        uploadId: created.uploadId,
        chunkSizeBytes: ADMIN_MEDIA_UPLOAD_CHUNK_BYTES,
      });
    }

    if (action === "complete") {
      const parsed = completeSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid completion request.", 400);
      const key = validateMediaUploadKey(parsed.data.key);
      const parts = [...parsed.data.parts].sort((a, b) => a.partNumber - b.partNumber);
      const seen = new Set<number>();
      if (parts.some((part) => seen.has(part.partNumber) || !seen.add(part.partNumber))) {
        return jsonError("Duplicate multipart part number.", 400);
      }

      await storage.completeMultipartUpload({ key, uploadId: parsed.data.uploadId, parts });
      try {
        const asset = await new PostgresAdminMediaRepository().createAsset({
          title: parsed.data.title,
          provider: "storage",
          sourceType: "DIRECT",
          providerAssetId: key,
          durationSeconds: parsed.data.durationSeconds ?? null,
          status: "READY",
        });
        return NextResponse.json({ ok: true, asset }, { status: 201 });
      } catch (error) {
        if (storage.deleteObject) {
          await storage.deleteObject(key).catch(() => undefined);
        }
        throw error;
      }
    }

    if (action === "abort") {
      const parsed = abortSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid abort request.", 400);
      const key = validateMediaUploadKey(parsed.data.key);
      await storage.abortMultipartUpload({ key, uploadId: parsed.data.uploadId });
      return NextResponse.json({ ok: true });
    }

    return jsonError("Unsupported upload action.", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media upload failed.";
    return jsonError(message, 400);
  }
}

export async function PUT(request: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized.", 401);

  const url = new URL(request.url);
  const keyRaw = url.searchParams.get("key") ?? "";
  const uploadIdRaw = url.searchParams.get("uploadId") ?? "";
  const partNumberRaw = Number(url.searchParams.get("partNumber"));
  const uploadId = uploadIdSchema.safeParse(uploadIdRaw);
  const partNumber = z.number().int().min(1).max(10000).safeParse(partNumberRaw);
  if (!uploadId.success || !partNumber.success) return jsonError("Invalid multipart part request.", 400);

  try {
    const key = validateMediaUploadKey(keyRaw);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > ADMIN_MEDIA_UPLOAD_CHUNK_BYTES) {
      return jsonError("Invalid multipart chunk size.", 400);
    }
    const uploaded = await getAdminMediaStorageProvider().uploadPart({
      key,
      uploadId: uploadId.data,
      partNumber: partNumber.data,
      bytes,
    });
    return NextResponse.json({ ok: true, partNumber: uploaded.partNumber, etag: uploaded.etag });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media part upload failed.";
    return jsonError(message, 400);
  }
}
