"use client";

import { useMemo, useState } from "react";
import { Copy, Inbox, MessageSquareText, Plus, Radio, TestTube2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface AdminLiveAttendeeMessageItem {
  id: string;
  displayName?: string | null;
  message: string;
  createdAt: string;
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
  timelineCount?: number;
}

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
  attendeeMessages: AdminLiveAttendeeMessageItem[];
}

export interface AdminLiveMediaItem {
  id: string;
  title: string;
  sourceType: string;
  durationSeconds?: number | null;
  status: string;
}

interface ActionResult {
  ok?: boolean;
  message?: string;
  imported?: number;
  errors?: Array<{ line: number; message: string }>;
}

async function postAction(payload: Record<string, unknown>): Promise<ActionResult> {
  const response = await fetch("/api/admin/live-classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as ActionResult;
  if (!response.ok || !result.ok) throw new Error(result.message ?? "Live class action failed.");
  return result;
}

function sessionState(session: AdminLiveSessionItem, batchStatus: AdminLiveBatchItem["status"]): string {
  if (batchStatus !== "ACTIVE" || session.status !== "PUBLISHED") return "NOT LIVE";
  const now = Date.now();
  const starts = new Date(session.startsAt).getTime();
  const ends = starts + session.durationSeconds * 1000;
  if (now < starts) return "UPCOMING";
  if (now >= starts && now < ends) return "LIVE";
  return "ENDED";
}

export function AdminLiveClassManager({ batches, media, publicBaseUrl }: {
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

  async function run(task: () => Promise<ActionResult>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      setMessage(result.errors?.length ? `${success} ${result.errors.length} row warning(s).` : success);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createBatch(formData: FormData) {
    await run(() => postAction({
      action: "createBatch",
      title: String(formData.get("title") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      description: String(formData.get("description") ?? ""),
      expectedViewerBaseline: Number(formData.get("expectedViewerBaseline") ?? 0),
      viewerDisplayMode: viewerMode,
      endedMessage: String(formData.get("endedMessage") ?? ""),
      endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? ""),
      notificationDestination: String(formData.get("notificationDestination") ?? ""),
    }), "Live class batch created.");
  }

  async function createSession(batchId: string, formData: FormData) {
    await run(() => postAction({
      action: "createSession",
      batchId,
      title: String(formData.get("title") ?? ""),
      position: Number(formData.get("position") ?? 1),
      startsAt: new Date(String(formData.get("startsAt") ?? "")).toISOString(),
      durationSeconds: Number(formData.get("durationMinutes") ?? 60) * 60,
      mediaAssetId: String(formData.get("mediaAssetId") ?? "") || null,
      status: "PUBLISHED",
      ctaText: String(formData.get("ctaText") ?? ""),
      ctaUrl: String(formData.get("ctaUrl") ?? ""),
      ctaRevealOffsetSeconds: Number(formData.get("ctaRevealMinutes") ?? 0) * 60,
      endedMessage: String(formData.get("endedMessage") ?? ""),
      endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? ""),
    }), "Session added and published.");
  }

  async function importTimeline(sessionId: string, formData: FormData) {
    const content = String(formData.get("timeline") ?? "");
    const result = await postAction({ action: "importTimeline", sessionId, format: timelineFormat, content });
    setMessage(`Imported ${result.imported ?? 0} synchronized chat message(s)${result.errors?.length ? ` with ${result.errors.length} warning(s)` : ""}.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{message}</div> : null}

      <Card className="border-blue-500/30 bg-blue-500/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><TestTube2 className="size-4" /> Test the live room now</CardTitle>
          <CardDescription>Create a temporary 15-minute LIVE room immediately. No video is required; viewer count, LIVE state, chat, comments and CTA behavior can be tested.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Test viewer count</span><Input id="quick-test-viewers" type="number" min="0" defaultValue="100" /></label>
          <Button disabled={busy} onClick={() => {
            const element = document.getElementById("quick-test-viewers") as HTMLInputElement | null;
            void run(() => postAction({ action: "testNow", expectedViewerBaseline: Number(element?.value ?? 100) }), "Live test room created. Copy its link below and open it in another tab.");
          }}><Radio className="mr-1.5 size-4" /> Start 15-minute live test</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create live class batch</CardTitle>
          <CardDescription>Create the shareable temporary class link. Registration/payment remain outside MkLMS.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createBatch} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm"><span className="font-medium">Title</span><Input name="title" required placeholder="September Free Class" /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Public slug</span><Input name="slug" placeholder="september-free-class" /></label>
            <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Description</span><Textarea name="description" rows={2} /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Expected audience / viewer baseline</span><Input name="expectedViewerBaseline" type="number" min="0" defaultValue="0" /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Viewer count display</span><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={viewerMode} onChange={(e) => setViewerMode(e.target.value as AdminLiveBatchItem["viewerDisplayMode"])}><option value="CONFIGURED_BASELINE">Configured expected audience</option><option value="ACTIVE_ONLY">Measured active viewers only</option><option value="BASELINE_PLUS_ACTIVE">Baseline + active viewers</option></select></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">After class message</span><Input name="endedMessage" placeholder="This class has ended." /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">After class redirect</span><Input name="endedRedirectUrl" placeholder="https://..." /></label>
            <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Telegram/notification destination (optional)</span><Input name="notificationDestination" placeholder="Telegram chat/channel ID; overrides default destination for this batch" /></label>
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
                <div><CardTitle className="flex items-center gap-2 text-base"><Radio className="size-4" /> {batch.title}</CardTitle><CardDescription className="mt-1">{batch.status} · {batch.sessions.length}/3 sessions · viewer baseline {batch.expectedViewerBaseline}</CardDescription></div>
                <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl)}><Copy className="mr-1.5 size-4" /> Copy link</Button>{batch.status !== "ACTIVE" ? <Button type="button" size="sm" disabled={busy} onClick={() => void run(() => postAction({ action: "setBatchStatus", batchId: batch.id, status: "ACTIVE" }), "Live class activated.")}>Activate</Button> : <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => postAction({ action: "setBatchStatus", batchId: batch.id, status: "DRAFT" }), "Live class deactivated.")}>Deactivate</Button>}</div>
              </div>
              <p className="break-all text-xs text-muted-foreground">{publicUrl}</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3">
                {batch.sessions.map((session) => {
                  const state = sessionState(session, batch.status);
                  return <div key={session.id} className="rounded-lg border p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="font-medium">Day {session.position}: {session.title}</p><p className="text-xs text-muted-foreground">{new Date(session.startsAt).toLocaleString()} · {Math.round(session.durationSeconds / 60)} min · {session.mediaAssetId ? "media attached" : "no-media test capable"}</p></div>
                      <div className="flex items-center gap-2"><span className={state === "LIVE" ? "rounded-full bg-red-600 px-2 py-1 text-[11px] font-bold text-white" : "rounded-full border px-2 py-1 text-[11px] text-muted-foreground"}>{state}</span><Button type="button" size="sm" variant="outline" onClick={() => void run(() => postAction({ action: "setSessionStatus", sessionId: session.id, status: session.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }), "Session status updated.")}>{session.status === "PUBLISHED" ? "Unpublish" : "Publish"}</Button></div>
                    </div>
                    <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/[0.03] p-3">
                      <div className="flex flex-wrap items-center gap-2"><MessageSquareText className="size-4" /><span className="text-sm font-semibold">Chat Sync / Import</span><span className="text-xs text-muted-foreground">timestamps are offsets from this session/video start</span><select className="ml-auto h-8 rounded-md border bg-background px-2 text-xs" value={timelineFormat} onChange={(e) => setTimelineFormat(e.target.value as "csv" | "text")}><option value="text">Timestamped / Zoom text</option><option value="csv">CSV</option></select></div>
                      <p className="mt-2 text-xs text-muted-foreground">Text example: <code>00:00:10 Ada: Good evening</code>. CSV header: <code>offset_seconds,display_name,message</code>. Messages appear to attendees when the live offset reaches each timestamp.</p>
                      <form action={(formData) => importTimeline(session.id, formData)} className="mt-3 space-y-2"><Textarea name="timeline" rows={5} placeholder={timelineFormat === "csv" ? "offset_seconds,display_name,message\n10,Ada,Good evening" : "00:00:10 Ada: Good evening\n00:01:05 John: I can hear you"} /><Button type="submit" size="sm" variant="outline" disabled={busy}><Upload className="mr-1.5 size-4" /> Import synchronized chat</Button></form>
                    </div>
                  </div>;
                })}
              </div>

              {batch.sessions.length < 3 ? <form action={(formData) => createSession(batch.id, formData)} className="grid gap-3 rounded-lg border border-dashed p-4 md:grid-cols-2"><p className="font-medium md:col-span-2">Add session / day</p><Input name="title" required placeholder="Day 1 — Foundation" /><Input name="position" required type="number" min="1" max="3" defaultValue={batch.sessions.length + 1} /><label className="space-y-1 text-xs"><span>Start date & time</span><Input name="startsAt" type="datetime-local" required /></label><label className="space-y-1 text-xs"><span>Duration (minutes)</span><Input name="durationMinutes" type="number" min="1" defaultValue="60" required /></label><label className="space-y-1 text-xs md:col-span-2"><span>Media (optional for live-room testing; recommended for real class)</span><select name="mediaAssetId" className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="">No media — test room only</option>{readyMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.sourceType}</option>)}</select></label><Input name="ctaText" placeholder="CTA text (optional)" /><Input name="ctaUrl" placeholder="CTA URL (optional)" /><Input name="ctaRevealMinutes" type="number" min="0" defaultValue="0" placeholder="CTA reveal minute" /><Input name="endedMessage" placeholder="Session ended message" /><Input name="endedRedirectUrl" className="md:col-span-2" placeholder="Session ended redirect (optional)" /><div className="md:col-span-2"><Button type="submit" size="sm" disabled={busy}><Plus className="mr-1.5 size-4" /> Add session</Button></div></form> : null}

              <div className="rounded-lg border bg-muted/10 p-4"><div className="mb-3 flex items-center gap-2"><Inbox className="size-4" /><div><p className="text-sm font-medium">Live attendee inbox</p><p className="text-xs text-muted-foreground">All real attendee comments. Attendees never see each other&apos;s real comments.</p></div><span className="ml-auto rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{batch.attendeeMessages.length}</span></div>{batch.attendeeMessages.length ? <div className="max-h-80 space-y-2 overflow-y-auto pr-1">{batch.attendeeMessages.map((item) => <div key={item.id} className="rounded-md border bg-background p-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium">{item.displayName || "Attendee"}</span><span className="text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No real attendee comments yet.</p>}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
