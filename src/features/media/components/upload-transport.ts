export interface UploadProgress {
  loadedBytes: number;
  totalBytes: number;
}

export interface UploadResponse {
  etag: string | null;
}

export function uploadBlobWithProgress(
  url: string,
  body: Blob,
  onProgress: (loadedBytes: number, totalBytes: number) => void = () => undefined,
  contentType?: string,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    if (contentType) request.setRequestHeader("Content-Type", contentType);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    });
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("Upload request failed."));
        return;
      }
      resolve({ etag: request.getResponseHeader("ETag") });
    });
    request.addEventListener("error", () => reject(new Error("Network error while uploading.")));
    request.addEventListener("abort", () => reject(new Error("Upload was canceled.")));
    request.send(body);
  });
}
