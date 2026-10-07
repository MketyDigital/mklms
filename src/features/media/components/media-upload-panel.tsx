"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  | { ok?: false; message?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function MediaUploadPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function uploadSingle(file: File, authorization: SingleUploadAuthorization) {
    const uploadResponse = await fetch(authorization.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new Error(`R2 rejected the upload (${uploadResponse.status}). The file was not registered.`);
    }
    setProgress(100);
  }

  async function uploadMultipart(file: File, authorization: MultipartUploadAuthorization) {
    const partCount = Math.ceil(file.size / authorization.partSizeBytes);
    const completed: Array<{ partNumber: number; etag: string }> = new Array(partCount);
    let completedBytes = 0;

    const uploadPart = async (partIndex: number) => {
      const partNumber = partIndex + 1;
      const start = partIndex * authorization.partSizeBytes;
      const end = Math.min(file.size, start + authorization.partSizeBytes);
      const body = file.slice(start, end);

      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
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

          const partResponse = await fetch(signed.uploadUrl, {
            method: "PUT",
            body,
          });
          if (!partResponse.ok) {
            throw new Error(`R2 rejected video part ${partNumber} (${partResponse.status}).`);
          }
          const etag = partResponse.headers.get("ETag") ?? partResponse.headers.get("etag");
          if (!etag) {
            throw new Error("R2 uploaded a video part but did not expose its ETag. Check the installation R2 CORS contract.");
          }

          completed[partIndex] = { partNumber, etag };
          completedBytes += body.size;
          setProgress(Math.min(99, Math.floor((completedBytes / file.size) * 100)));
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Multipart upload failed.");
          if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
        }
      }
      throw lastError ?? new Error(`Could not upload video part ${partNumber}.`);
    };

    try {
      let nextPart = 0;
      const workers = Array.from({ length: Math.min(3, partCount) }, async () => {
        while (true) {
          const partIndex = nextPart;
          nextPart += 1;
          if (partIndex >= partCount) return;
          await uploadPart(partIndex);
        }
      });
      await Promise.all(workers);

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
        throw new Error(completedUpload?.message ?? "R2 could not complete the multipart video upload.");
      }
      setProgress(100);
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
      setMessage("Choose an MP4 file and enter a title.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".mp4")) {
      setMessage("Only MP4 video files are supported.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setProgress(0);
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
        throw new Error(authorization && "message" in authorization ? authorization.message ?? "Could not prepare the private R2 upload." : "Could not prepare the private R2 upload.");
      }

      if (authorization.mode === "single") {
        await uploadSingle(file, authorization);
      } else {
        setMessage("Large video detected. Uploading securely in retryable parts…");
        await uploadMultipart(file, authorization);
      }

      const finalizeResponse = await fetch("/api/admin/media/direct-upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          objectKey: authorization.objectKey,
          durationSeconds,
        }),
      });
      const finalized = (await finalizeResponse.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!finalizeResponse.ok || !finalized?.ok) {
        throw new Error(finalized?.message ?? "The MP4 reached R2 but could not be added to the media library.");
      }

      setMessage("MP4 uploaded directly to private R2 and added to the media library.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload media.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload protected MP4</CardTitle>
        <CardDescription>
          Uploads go directly from your browser to the installation&apos;s private R2 bucket. Large videos are automatically split into retryable parts so the application Worker never has to proxy the video bytes.
        </CardDescription>
      </CardHeader>
      <CardContent>
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

          {progress !== null && busy ? (
            <div className="space-y-1 md:col-span-2" aria-live="polite">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Upload progress</span>
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
            <Button type="submit" disabled={busy}>
              <Upload className="mr-1.5 size-4" />
              {busy ? "Uploading…" : "Upload MP4"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
