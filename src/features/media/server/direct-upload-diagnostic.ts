import {
  abortDirectR2MultipartUpload,
  createDirectR2UploadAuthorization,
  MULTIPART_THRESHOLD_BYTES,
} from "@/features/media/server/r2-direct-upload";
import type { DirectMultipartStorageDiagnostic } from "./upload-diagnostic";
import { normalizeUploadDiagnosticFailure } from "./upload-diagnostic";

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
