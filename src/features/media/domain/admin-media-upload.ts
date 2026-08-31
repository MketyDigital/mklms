import { randomUUID } from "node:crypto";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const UPLOAD_KEY_PATTERN = /^media\/uploads\/\d{4}\/\d{2}\/[a-zA-Z0-9-]+-[a-z0-9-]+\.mp4$/;

export interface AdminMediaUploadRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export function validateAdminMediaUpload(input: AdminMediaUploadRequest): AdminMediaUploadRequest {
  const filename = input.filename.trim();
  const contentType = input.contentType.trim().toLowerCase();
  const sizeBytes = Number(input.sizeBytes);

  if (!filename.toLowerCase().endsWith(".mp4") || contentType !== "video/mp4") {
    throw new Error("Admin media upload accepts MP4 video files only.");
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Video upload size must be a non-empty positive integer.");
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error("Video upload exceeds the 2 GiB admin upload limit.");
  }

  return { filename, contentType, sizeBytes };
}

function safeBaseName(filename: string): string {
  const leaf = filename.replace(/\\/g, "/").split("/").pop() || "video.mp4";
  const withoutExt = leaf.replace(/\.mp4$/i, "");
  const normalized = withoutExt
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "video";
}

export function createMediaUploadKey(
  filename: string,
  now: Date = new Date(),
  id: string = randomUUID(),
): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const cleanId = id.trim().replace(/[^a-zA-Z0-9-]/g, "");
  if (!cleanId) throw new Error("Invalid upload identifier.");
  return `media/uploads/${year}/${month}/${cleanId}-${safeBaseName(filename)}.mp4`;
}

export function validateMediaUploadKey(key: string): string {
  const normalized = key.trim();
  if (!UPLOAD_KEY_PATTERN.test(normalized) || normalized.includes("..") || normalized.includes("\\")) {
    throw new Error("Invalid admin media upload key.");
  }
  return normalized;
}

export const ADMIN_MEDIA_UPLOAD_CHUNK_BYTES = 10 * 1024 * 1024;
export const ADMIN_MEDIA_UPLOAD_MAX_BYTES = MAX_UPLOAD_BYTES;
