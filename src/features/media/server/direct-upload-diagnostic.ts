import {
  abortDirectR2MultipartUpload,
  createDirectR2UploadAuthorization,
  MULTIPART_THRESHOLD_BYTES,
} from "@/features/media/server/r2-direct-upload";

type DiagnosticStage = "start" | "cleanup";

export type DirectMultipartStorageDiagnostic =
  | { ok: true }
  | {
      ok: false;
      stage: DiagnosticStage;
      detailCode: string;
      httpStatusCode: number | null;
      storageRequestId: string | null;
    };

function safeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) return null;
  return /^[A-Za-z0-9._:-]+$/.test(value) ? value : null;
}

export function normalizeUploadDiagnosticFailure(
  error: unknown,
  stage: DiagnosticStage,
): DirectMultipartStorageDiagnostic {
  const record = error && typeof error === "object"
    ? error as {
        name?: unknown;
        Code?: unknown;
        code?: unknown;
        $metadata?: { httpStatusCode?: unknown; requestId?: unknown };
      }
    : {};
  const detailCode = safeString(record.name, 80)
    ?? safeString(record.Code, 80)
    ?? safeString(record.code, 80)
    ?? "StorageRequestFailed";
  const status = record.$metadata?.httpStatusCode;
  const requestId = safeString(record.$metadata?.requestId, 128);

  return {
    ok: false,
    stage,
    detailCode,
    httpStatusCode: typeof status === "number" && Number.isInteger(status) ? status : null,
    storageRequestId: requestId,
  };
}

export async function runDirectMultipartStorageDiagnostic(): Promise<DirectMultipartStorageDiagnostic> {
  try {
    const authorization = await createDirectR2UploadAuthorization({
      contentType: "video/mp4",
      sizeBytes: MULTIPART_THRESHOLD_BYTES + 1,
    });
    if (authorization.mode !== "multipart") {
      return {
        ok: false,
        stage: "start",
        detailCode: "MultipartModeNotSelected",
        httpStatusCode: null,
        storageRequestId: null,
      };
    }

    try {
      await abortDirectR2MultipartUpload({
        objectKey: authorization.objectKey,
        uploadId: authorization.uploadId,
      });
    } catch (error) {
      return normalizeUploadDiagnosticFailure(error, "cleanup");
    }

    return { ok: true };
  } catch (error) {
    return normalizeUploadDiagnosticFailure(error, "start");
  }
}
