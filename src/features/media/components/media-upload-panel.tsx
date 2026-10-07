"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getUploadPreparationMessage } from "@/features/media/components/upload-errors";
import { uploadBlobWithProgress } from "@/features/media/components/upload-transport";

interface SingleUploadAuthorization {
  ok: true;
  mode: "single";
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

interface MultipartUploadAuthorization {
  ok: true;
  mode: "multipart";
  uploadId: string;
  objectKey: string;
  partSizeBytes: number;
}

type UploadAuthorization =
  | SingleUploadAuthorization
  | MultipartUploadAuthorization
  | { ok?: false; code?: string; detailCode?: string; message?: string; requestId?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function MediaUploadPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [storageCheckBusy, setStorageCheckBusy] = useState(false);
  const [storageCheckMessage, setStorageCheckMessage] = useState<string | null>(null);

  async function checkStreamingStorage() {
    setStorageCheckBusy(true);
    setStorageCheckMessage("Checking Streaming Storage upload sessions…");
    try {
      const response = await fetch("/api/admin/media/direct-upload/check", { method: "POST" });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; stage?: string; detailCode?: string; httpStatusCode?: number | null; reference?: string | null }
        | null;
      if (response.ok && result?.ok) {
        setStorageCheckMessage("Streaming Storage can start and clean up multipart upload sessions.");
      } else if (response.status === 401) {
        setStorageCheckMessage("Your admin session expired. Sign in again and retry the check.");
      } else {
        const stage = result?.stage === "cleanup" ? "session cleanup" : "session start";
        const code = result?.detailCode ? ` (${result.detailCode})` : "";
        const status = result?.httpStatusCode ? ` — status ${result.httpStatusCode}` : "";
        const reference = result?.reference ? ` Reference: ${result.reference}.` : "";
        setStorageCheckMessage(`Streaming Storage check failed during ${stage}${code}${status}.${reference}`);
      }
    } catch {
      setStorageCheckMessage("Could not reach the portal to check Streaming Storage. Check your connection and retry.");
    } finally {
      setStorageCheckBusy(false);
    }
  }

  async function uploadSingle(file: File, authorization: SingleUploadAuthorization) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await uploadBlobWithProgress(
          authorization.uploadUrl,
          file,
          (loadedBytes, totalBytes) => {
            if (totalBytes > 0) setProgress(Math.min(99, Math.floor((loadedBytes / totalBytes) * 100)));
          },
          "video/mp4",
        );
        setProgress(99);
        return;
      } catch {
        if (attempt < 3) await sleep(750 * 2 ** (attempt - 1));
      }
    }
    throw new Error("The file transfer did not finish.");
  }

  async function uploadMultipart(file: File, authorization: MultipartUploadAuthorization) {
    const partCount = Math.ceil(file.size / authorization.partSizeBytes);
    const completed: Array<{ partNumber: number; etag: string }> = new Array(partCount);
    const partBytesInProgress = new Array<number>(partCount).fill(0);
    let highestProgress = 0;
    const reportProgress = () => {
      const transferredBytes = partBytesInProgress.reduce((total, bytes) => total + bytes, 0);
      highestProgress = Math.max(highestProgress, Math.min(99, Math.floor((transferredBytes / file.size) * 100)));
      setProgress(highestProgress);
    };

    const uploadPart = async (partIndex: number) => {
      const partNumber = partIndex + 1;
      const start = partIndex * authorization.partSizeBytes;
      const end = Math.min(file.size, start + authorization.partSizeBytes);
      const body = file.slice(start, end);

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          partBytesInProgress[partIndex] = 0;
          reportProgress();
          const signResponse = await fetch("/api/admin/media/direct-upload/part", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              objectKey: authorization.objectKey,
              uploadId: authorization.uploadId,
              partNumber,
            }),
          });
          const signed = (await signResponse.json().catch(() => null)) as
            | { ok?: boolean; uploadUrl?: string; message?: string }
            | null;
          if (!signResponse.ok || !signed?.ok || !signed.uploadUrl) {
            throw new Error(signed?.message ?? `Could not authorize video part ${partNumber}.`);
          }

          const partResponse = await uploadBlobWithProgress(
            signed.uploadUrl,
            body,
            (loadedBytes) => {
              partBytesInProgress[partIndex] = loadedBytes;
              reportProgress();
            },
          );
          const etag = partResponse.etag;
          if (!etag) {
            throw new Error("The portal could not verify the uploaded video part.");
          }

          completed[partIndex] = { partNumber, etag };
          partBytesInProgress[partIndex] = body.size;
          reportProgress();
          return;
        } catch {
          if (attempt < 3) {
            setMessage(`Retrying video part ${partNumber} (attempt ${attempt + 1} of 3)…`);
            await sleep(500 * 2 ** (attempt - 1));
          }
        }
      }
      throw new Error(`Could not transfer video part ${partNumber}.`);
    };

    try {
      let nextPart = 0;
      let fatalError: Error | null = null;
      const workers = Array.from({ length: Math.min(3, partCount) }, async () => {
        while (!fatalError) {
          const partIndex = nextPart;
          nextPart += 1;
          if (partIndex >= partCount) return;
          try {
            await uploadPart(partIndex);
          } catch (error) {
            fatalError = error instanceof Error ? error : new Error("Multipart upload failed.");
          }
        }
      });
      await Promise.all(workers);
      if (fatalError) throw fatalError;

      const completeResponse = await fetch("/api/admin/media/direct-upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey: authorization.objectKey,
          uploadId: authorization.uploadId,
          parts: completed,
        }),
      });
      const completedUpload = (await completeResponse.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!completeResponse.ok || !completedUpload?.ok) {
        throw new Error("The video transfer could not be completed.");
      }
      setProgress(99);
    } catch (error) {
      await fetch("/api/admin/media/direct-upload/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey: authorization.objectKey,
          uploadId: authorization.uploadId,
        }),
      }).catch(() => null);
      throw error;
    }
  }

  async function submit(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const durationRaw = String(formData.get("durationSeconds") ?? "").trim();
    const durationSeconds = durationRaw ? Number(durationRaw) : null;
    const file = formData.get("file");

    if (!(file instanceof File) || !title) {
      setProgress(null);
      setMessage("Choose an MP4 file and enter a title.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".mp4")) {
      setProgress(null);
      setMessage("Only MP4 video files are supported.");
      return;
    }

    setBusy(true);
    setMessage("Preparing Streaming Storage upload…");
    setProgress(0);
    let failureStage: "preparing" | "transferring" | "saving" = "preparing";
    try {
      const initiateResponse = await fetch("/api/admin/media/direct-upload/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contentType: "video/mp4",
          sizeBytes: file.size,
          durationSeconds,
        }),
      });
      const authorization = (await initiateResponse.json().catch(() => null)) as UploadAuthorization | null;
      if (!initiateResponse.ok || !authorization?.ok) {
        const failure = authorization?.ok === false ? authorization : null;
        const requestId = failure?.requestId ?? initiateResponse.headers.get("cf-ray") ?? undefined;
        throw new Error(
          getUploadPreparationMessage(initiateResponse.status, {
            code: failure?.code,
            detailCode: failure?.detailCode,
            message: failure?.message,
            requestId,
          }),
        );
      }

      failureStage = "transferring";
      setMessage(authorization.mode === "multipart" ? "Uploading to Streaming Storage in retryable parts…" : "Uploading to Streaming Storage…");
      if (authorization.mode === "single") {
        await uploadSingle(file, authorization);
      } else {
        await uploadMultipart(file, authorization);
      }

      failureStage = "saving";
      setMessage("Transfer complete. Confirming save in the media library…");
      const finalizeResponse = await fetch("/api/admin/media/direct-upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          objectKey: authorization.objectKey,
          sizeBytes: file.size,
          durationSeconds,
        }),
      });
      const finalized = (await finalizeResponse.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!finalizeResponse.ok || !finalized?.ok) {
        throw new Error("The video transfer could not be confirmed in the media library.");
      }

      setProgress(100);
      setMessage("Upload complete and saved to the media library.");
      router.refresh();
    } catch (error) {
      if (failureStage === "preparing") {
        setMessage(error instanceof TypeError
          ? getUploadPreparationMessage(0, {})
          : error instanceof Error
            ? error.message
            : getUploadPreparationMessage(0, {}));
      } else if (failureStage === "transferring") {
        setMessage("The upload did not finish. Check your connection and try again.");
      } else {
        setMessage("The video transferred, but the portal could not confirm that it was saved. Refresh the media library before retrying.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload protected MP4</CardTitle>
        <CardDescription>
          Uploads go directly from your browser to the installation&apos;s private Streaming Storage. Large videos are sent in retryable parts, while smaller videos transfer in one stream.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={checkStreamingStorage} disabled={busy || storageCheckBusy}>
            {storageCheckBusy ? "Checking…" : "Check Streaming Storage"}
          </Button>
          {storageCheckMessage ? <p className="text-sm text-muted-foreground" aria-live="polite">{storageCheckMessage}</p> : null}
        </div>
        <form action={submit} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Title</span>
            <Input name="title" required placeholder="Module 1 — Introduction" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Duration (seconds)</span>
            <Input name="durationSeconds" type="number" min="1" step="1" placeholder="3600" />
          </label>
          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium">MP4 file</span>
            <Input name="file" type="file" accept="video/mp4,.mp4" required />
            <span className="block text-xs text-muted-foreground">Supports MP4 videos up to 50 GB. Large files use automatic multipart upload and retry failed parts.</span>
          </label>

          {progress !== null ? (
            <div className="space-y-1 md:col-span-2" aria-live="polite">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Streaming Storage upload</span>
                <span>{progress}%</span>
              </div>
              <progress className="h-2 w-full" max={100} value={progress} />
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm md:col-span-2">
              {message}
            </div>
          ) : null}

          <div className="md:col-span-2">
            <Button type="submit" disabled={busy || storageCheckBusy}>
              <Upload className="mr-1.5 size-4" />
              {busy ? "Uploading…" : "Upload MP4"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
