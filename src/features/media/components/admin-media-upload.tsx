"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CreateUploadResponse {
  ok: boolean;
  key?: string;
  uploadId?: string;
  chunkSizeBytes?: number;
  message?: string;
}

interface UploadedPart {
  partNumber: number;
  etag: string;
}

export function AdminMediaUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const file = formData.get("video");
    const title = String(formData.get("title") ?? "").trim();
    const durationRaw = String(formData.get("durationSeconds") ?? "").trim();
    if (!(file instanceof File) || file.size <= 0) {
      setMessage("Choose an MP4 video to upload.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".mp4")) {
      setMessage("Only MP4 video uploads are supported here.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setMessage(null);
    let uploadKey = "";
    let uploadId = "";

    try {
      const createResponse = await fetch("/api/admin/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          filename: file.name,
          contentType: "video/mp4",
          sizeBytes: file.size,
        }),
      });
      const created = (await createResponse.json()) as CreateUploadResponse;
      if (!createResponse.ok || !created.ok || !created.key || !created.uploadId || !created.chunkSizeBytes) {
        throw new Error(created.message ?? "Could not start media upload.");
      }
      uploadKey = created.key;
      uploadId = created.uploadId;

      const chunkSize = created.chunkSizeBytes;
      const totalParts = Math.ceil(file.size / chunkSize);
      const parts: UploadedPart[] = [];

      for (let index = 0; index < totalParts; index += 1) {
        const partNumber = index + 1;
        const chunk = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
        const params = new URLSearchParams({
          key: uploadKey,
          uploadId,
          partNumber: String(partNumber),
        });
        const partResponse = await fetch(`/api/admin/media/upload?${params.toString()}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: chunk,
        });
        const partPayload = (await partResponse.json()) as {
          ok?: boolean;
          partNumber?: number;
          etag?: string;
          message?: string;
        };
        if (!partResponse.ok || !partPayload.ok || !partPayload.partNumber || !partPayload.etag) {
          throw new Error(partPayload.message ?? `Could not upload part ${partNumber}.`);
        }
        parts.push({ partNumber: partPayload.partNumber, etag: partPayload.etag });
        setProgress(Math.round((parts.length / totalParts) * 95));
      }

      const completeResponse = await fetch("/api/admin/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          key: uploadKey,
          uploadId,
          parts,
          title: title || file.name.replace(/\.mp4$/i, ""),
          durationSeconds: durationRaw ? Number(durationRaw) : null,
        }),
      });
      const completed = (await completeResponse.json()) as { ok?: boolean; message?: string };
      if (!completeResponse.ok || !completed.ok) {
        throw new Error(completed.message ?? "Could not finish media upload.");
      }

      setProgress(100);
      setMessage("Video uploaded privately and added to the media library.");
      router.refresh();
    } catch (error) {
      if (uploadKey && uploadId) {
        await fetch("/api/admin/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "abort", key: uploadKey, uploadId }),
        }).catch(() => undefined);
      }
      setMessage(error instanceof Error ? error.message : "Media upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload private video</CardTitle>
        <CardDescription>
          Upload an MP4 directly to the configured private storage. On Cloudflare this uses the bound R2 bucket; other installations use the configured S3-compatible storage adapter. The stored object is automatically registered for protected DIRECT playback.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submit} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Title</span>
            <Input name="title" maxLength={200} placeholder="Module 1 — Introduction" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Duration (seconds, optional)</span>
            <Input name="durationSeconds" type="number" min="1" placeholder="3600" />
          </label>
          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium">MP4 video</span>
            <Input name="video" type="file" accept="video/mp4,.mp4" required disabled={busy} />
          </label>

          {busy || progress > 0 ? (
            <div className="space-y-1.5 md:col-span-2" aria-live="polite">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{busy ? "Uploading…" : "Upload complete"}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm md:col-span-2" aria-live="polite">
              {message}
            </div>
          ) : null}

          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              <Upload className="mr-1.5 size-4" /> {busy ? "Uploading…" : "Upload & register video"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
