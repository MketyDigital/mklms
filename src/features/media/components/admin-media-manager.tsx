"use client";

import { useState } from "react";
import { Film, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface AdminMediaItem {
  id: string;
  title: string;
  provider: string;
  sourceType: string;
  providerAssetId?: string | null;
  durationSeconds?: number | null;
  status: string;
}

export function AdminMediaManager({ initialAssets }: { initialAssets: AdminMediaItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState("HLS");

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const durationRaw = String(formData.get("durationSeconds") ?? "").trim();
      const response = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          provider: String(formData.get("provider") ?? "custom"),
          sourceType,
          providerAssetId: String(formData.get("providerAssetId") ?? ""),
          durationSeconds: durationRaw ? Number(durationRaw) : null,
          status: "READY",
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Could not create media asset.");
      }
      setMessage("Media asset added to the library.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create media asset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register media asset</CardTitle>
          <CardDescription>
            Register the provider playback reference only. For private HLS/direct media this should be an opaque provider path or asset reference—not a public storage URL. Upload/transcoding can be supplied by the configured media adapter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submit} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Title</span>
              <Input name="title" required placeholder="Module 1 — Introduction" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Provider label</span>
              <Input name="provider" defaultValue="custom" placeholder="oci-r2, s3, youtube…" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Source type</span>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
              >
                <option value="HLS">HLS / m3u8</option>
                <option value="DIRECT">Direct protected file</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="EXTERNAL_EMBED">External embed</option>
                <option value="CUSTOM">Custom provider</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Duration (seconds)</span>
              <Input name="durationSeconds" type="number" min="1" placeholder="3600" />
            </label>
            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">
                {sourceType === "YOUTUBE" || sourceType === "EXTERNAL_EMBED"
                  ? "Embed URL / provider reference"
                  : "Private provider playback reference"}
              </span>
              <Input
                name="providerAssetId"
                required
                placeholder={
                  sourceType === "YOUTUBE" || sourceType === "EXTERNAL_EMBED"
                    ? "https://…"
                    : "courses/course-1/lesson-1/master.m3u8"
                }
              />
            </label>

            {message ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm md:col-span-2">
                {message}
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                <Plus className="mr-1.5 size-4" /> Add media asset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media library</CardTitle>
          <CardDescription>
            Lessons refer to these records by ID; storage/origin details remain server-side.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialAssets.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Film className="mb-2 size-8" /> No media assets yet.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {initialAssets.map((asset) => (
                <div key={asset.id} className="grid gap-2 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-medium">{asset.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {asset.sourceType} · {asset.provider} · {asset.durationSeconds ? `${asset.durationSeconds}s` : "duration not set"}
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">ID: {asset.id}</p>
                  </div>
                  <span className="w-fit rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400">
                    {asset.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
