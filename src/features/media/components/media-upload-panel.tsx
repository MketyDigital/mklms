"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface UploadAuthorization {
  ok?: boolean;
  uploadUrl?: string;
  objectKey?: string;
  message?: string;
}

export function MediaUploadPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const durationRaw = String(formData.get("durationSeconds") ?? "").trim();
    const durationSeconds = durationRaw ? Number(durationRaw) : null;
    const file = formData.get("file");

    if (!(file instanceof File) || !title) {
      setMessage("Choose an MP4 file and enter a title.");
      return;
    }
    if (file.type !== "video/mp4" || !file.name.toLowerCase().endsWith(".mp4")) {
      setMessage("Only MP4 video files are supported.");
      return;
    }

    setBusy(true);
    setMessage(null);
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
      if (!initiateResponse.ok || !authorization?.ok || !authorization.uploadUrl || !authorization.objectKey) {
        throw new Error(authorization?.message ?? "Could not prepare the private R2 upload.");
      }

      const uploadResponse = await fetch(authorization.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`R2 rejected the upload (${uploadResponse.status}). Check the bucket CORS and direct-upload credentials.`);
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
          The browser uploads the MP4 directly to the configured private R2 bucket. MkLMS only authorizes and registers the private media object; the video bytes do not pass through the application Worker.
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
          </label>

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
