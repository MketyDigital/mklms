export type DiagnosticStage = "start" | "cleanup";

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
