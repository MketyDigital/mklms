"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function MediaUploadPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Could not upload media.");
      }

      setMessage("MP4 uploaded privately and added to the media library.");
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
          Upload an MP4 directly to the configured private storage. The stored object is registered as protected DIRECT media and is never exposed as a permanent public URL.
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
