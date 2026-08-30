"use client";

import { useMemo, useState } from "react";
import { Copy, MessageSquareText, Plus, Radio, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface AdminLiveBatchItem {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  expectedViewerBaseline: number;
  viewerDisplayMode: "CONFIGURED_BASELINE" | "ACTIVE_ONLY" | "BASELINE_PLUS_ACTIVE";
  endedMessage?: string | null;
  endedRedirectUrl?: string | null;
  notificationDestination?: string | null;
  sessions: AdminLiveSessionItem[];
}

export interface AdminLiveSessionItem {
  id: string;
  title: string;
  position: number;
  startsAt: string;
  durationSeconds: number;
  mediaAssetId?: string | null;
  status: "DRAFT" | "PUBLISHED";
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaRevealOffsetSeconds?: number | null;
}

export interface AdminLiveMediaItem {
  id: string;
  title: string;
  sourceType: string;
  durationSeconds?: number | null;
  status: string;
}

async function postAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/live-classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { ok?: boolean; message?: string; errors?: Array<{ line: number; message: string }> };
  if (!response.ok || !result.ok) throw new Error(result.message ?? "Live class action failed.");
  return result;
}

export function AdminLiveClassManager({
  batches,
  media,
  publicBaseUrl,
}: {
  batches: AdminLiveBatchItem[];
  media: AdminLiveMediaItem[];
  publicBaseUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<AdminLiveBatchItem["viewerDisplayMode"]>("CONFIGURED_BASELINE");
  const [timelineFormat, setTimelineFormat] = useState<"csv" | "text">("text");

  const readyMedia = useMemo(() => media.filter((item) => item.status === "READY"), [media]);

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setMessage(success);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createBatch(formData: FormData) {
    await run(
      () => postAction({
        action: "createBatch",
        title: String(formData.get("title") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        description: String(formData.get("description") ?? ""),
        expectedViewerBaseline: Number(formData.get("expectedViewerBaseline") ?? 0),
        viewerDisplayMode: viewerMode,
        endedMessage: String(formData.get("endedMessage") ?? ""),
        endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? ""),
        notificationDestination: String(formData.get("notificationDestination") ?? ""),
      }),
      "Live class batch created.",
    );
  }

  async function createSession(batchId: string, formData: FormData) {
    const startsAt = String(formData.get("startsAt") ?? "");
    await run(
      () => postAction({
        action: "createSession",
        batchId,
        title: String(formData.get("title") ?? ""),
        position: Number(formData.get("position") ?? 1),
        startsAt: new Date(startsAt).toISOString(),
        durationSeconds: Number(formData.get("durationMinutes") ?? 60) * 60,
        mediaAssetId: String(formData.get("mediaAssetId") ?? "") || null,
        status: "PUBLISHED",
        ctaText: String(formData.get("ctaText") ?? ""),
        ctaUrl: String(formData.get("ctaUrl") ?? ""),
        ctaRevealOffsetSeconds: Number(formData.get("ctaRevealMinutes") ?? 0) * 60,
        endedMessage: String(formData.get("endedMessage") ?? ""),
        endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? ""),
      }),
      "Session added.",
    );
  }

  async function importTimeline(sessionId: string, formData: FormData) {
    const content = String(formData.get("timeline") ?? "");
    await run(async () => {
      const result = await postAction({ action: "importTimeline", sessionId, format: timelineFormat, content });
      if (result.errors?.length) {
        setMessage(`Imported with ${result.errors.length} row warning(s).`);
      }
    }, "Staged chat imported.");
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{message}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create live class batch</CardTitle>
          <CardDescription>
            Create the temporary public class link. Marketing and registration remain outside MkLMS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createBatch} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm"><span className="font-medium">Title</span><Input name="title" required placeholder="September Free Class" /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Public slug</span><Input name="slug" placeholder="september-free-class" /></label>
            <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Description</span><Textarea name="description" rows={2} /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Expected audience / viewer baseline</span><Input name="expectedViewerBaseline" type="number" min="0" defaultValue="0" /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Viewer count display</span>
              <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={viewerMode} onChange={(e) => setViewerMode(e.target.value as AdminLiveBatchItem["viewerDisplayMode"])}>
                <option value="CONFIGURED_BASELINE">Configured expected audience</option>
                <option value="ACTIVE_ONLY">Measured active viewers only</option>
                <option value="BASELINE_PLUS_ACTIVE">Baseline + measured active viewers</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">After class message</span><Input name="endedMessage" placeholder="This class has ended." /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">After class redirect</span><Input name="endedRedirectUrl" placeholder="https://..." /></label>
            <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Notification destination (optional)</span><Input name="notificationDestination" placeholder="Telegram chat/channel ID or adapter destination" /></label>
            <div className="md:col-span-2"><Button type="submit" disabled={busy}><Plus className="mr-1.5 size-4" /> Create batch</Button></div>
          </form>
        </CardContent>
      </Card>

      {batches.map((batch) => {
        const publicUrl = `${publicBaseUrl}/live/${encodeURIComponent(batch.slug)}`;
        return (
          <Card key={batch.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><Radio className="size-4" /> {batch.title}</CardTitle>
                  <CardDescription className="mt-1">{batch.status} · {batch.sessions.length}/3 sessions · viewer baseline {batch.expectedViewerBaseline}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl)}><Copy className="mr-1.5 size-4" /> Copy link</Button>
                  {batch.status !== "ACTIVE" ? (
                    <Button type="button" size="sm" disabled={busy} onClick={() => void run(() => postAction({ action: "setBatchStatus", batchId: batch.id, status: "ACTIVE" }), "Live class activated.")}>Activate</Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => postAction({ action: "setBatchStatus", batchId: batch.id, status: "DRAFT" }), "Live class deactivated.")}>Deactivate</Button>
                  )}
                </div>
              </div>
              <p className="break-all text-xs text-muted-foreground">{publicUrl}</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3">
                {batch.sessions.map((session) => (
                  <div key={session.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="font-medium">Day {session.position}: {session.title}</p><p className="text-xs text-muted-foreground">{new Date(session.startsAt).toLocaleString()} · {Math.round(session.durationSeconds / 60)} min · {session.status}</p></div>
                      <Button type="button" size="sm" variant="outline" onClick={() => void run(() => postAction({ action: "setSessionStatus", sessionId: session.id, status: session.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }), "Session status updated.")}>{session.status === "PUBLISHED" ? "Unpublish" : "Publish"}</Button>
                    </div>
                    <form action={(formData) => importTimeline(session.id, formData)} className="mt-3 space-y-2">
                      <div className="flex items-center gap-2"><MessageSquareText className="size-4" /><span className="text-xs font-medium">Staged chat timeline</span>
                        <select className="ml-auto h-8 rounded-md border bg-background px-2 text-xs" value={timelineFormat} onChange={(e) => setTimelineFormat(e.target.value as "csv" | "text")}><option value="text">Timestamped / Zoom text</option><option value="csv">CSV</option></select>
                      </div>
                      <Textarea name="timeline" rows={4} placeholder={timelineFormat === "csv" ? "offset_seconds,display_name,message" : "00:00:10 Ada: Good evening"} />
                      <Button type="submit" size="sm" variant="outline" disabled={busy}><Upload className="mr-1.5 size-4" /> Import chat</Button>
                    </form>
                  </div>
                ))}
              </div>

              {batch.sessions.length < 3 ? (
                <form action={(formData) => createSession(batch.id, formData)} className="grid gap-3 rounded-lg border border-dashed p-4 md:grid-cols-2">
                  <p className="font-medium md:col-span-2">Add session / day</p>
                  <Input name="title" required placeholder="Day 1 — Foundation" />
                  <Input name="position" required type="number" min="1" max="3" defaultValue={batch.sessions.length + 1} />
                  <label className="space-y-1 text-xs"><span>Start date & time</span><Input name="startsAt" type="datetime-local" required /></label>
                  <label className="space-y-1 text-xs"><span>Duration (minutes)</span><Input name="durationMinutes" type="number" min="1" defaultValue="60" required /></label>
                  <label className="space-y-1 text-xs md:col-span-2"><span>Media</span><select name="mediaAssetId" required className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select Media Library asset</option>{readyMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.sourceType}</option>)}</select></label>
                  <Input name="ctaText" placeholder="CTA text (optional)" /><Input name="ctaUrl" placeholder="CTA URL (optional)" />
                  <Input name="ctaRevealMinutes" type="number" min="0" defaultValue="0" placeholder="CTA reveal minute" /><Input name="endedMessage" placeholder="Session ended message" />
                  <Input name="endedRedirectUrl" className="md:col-span-2" placeholder="Session ended redirect (optional)" />
                  <div className="md:col-span-2"><Button type="submit" size="sm" disabled={busy}><Plus className="mr-1.5 size-4" /> Add session</Button></div>
                </form>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
