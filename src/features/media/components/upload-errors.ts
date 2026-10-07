export interface UploadPreparationFailure {
  code?: string;
  detailCode?: string;
  message?: string;
  requestId?: string;
}

export function getUploadPreparationMessage(
  status: number,
  failure: UploadPreparationFailure,
): string {
  if (status === 0) {
    return "Could not reach the portal to prepare the upload. Check your connection and try again.";
  }
  if (status === 401) {
    return "Your admin session expired. Sign in again, then restart the upload.";
  }
  if (status === 402 || status === 429 || status === 400) {
    return failure.message ?? "The portal could not prepare this upload. Check the file details and try again.";
  }

  const detail = failure.detailCode
    ? ` Storage response: ${failure.detailCode}.`
    : "";
  const reference = failure.requestId ? ` Reference: ${failure.requestId}.` : "";
  return `Streaming Storage could not start an upload session.${detail} Please try again shortly.${reference}`;
}
