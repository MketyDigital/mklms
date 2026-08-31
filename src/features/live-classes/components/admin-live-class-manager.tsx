"use client";

import { useMemo, useState } from "react";
import { Copy, Inbox, MessageSquareText, Plus, Radio, TestTube2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface AdminLiveAttendeeMessageItem { id: string; displayName?: string | null; message: string; createdAt: string; }
export interface AdminLiveSessionItem {
  id: string; title: string; position: number; startsAt: string; durationSeconds: number; mediaAssetId?: string | null;
  status: "DRAFT" | "PUBLISHED"; ctaText?: string | null; ctaUrl?: string | null; ctaRevealOffsetSeconds?: number | null; timelineCount?: number;
}
export interface AdminLiveBatchItem {
  id: string; slug: string; title: string; description?: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  expectedViewerBaseline: number; viewerDisplayMode: "CONFIGURED_BASELINE" | "ACTIVE_ONLY" | "BASELINE_PLUS_ACTIVE";
  endedMessage?: string | null; endedRedirectUrl?: string | null; notificationDestination?: string | null;
  sessions: AdminLiveSessionItem[]; attendeeMessages: AdminLiveAttendeeMessageItem[];
}
export interface AdminLiveMediaItem { id: string; title: string; sourceType: string; durationSeconds?: number | null; status: string; }
interface ActionResult { ok?: boolean; message?: string; imported?: number; errors?: Array<{ line: number; message: string }>; }

async function postAction(payload: Record<string, unknown>): Promise<ActionResult> {
  const response = await fetch("/api/admin/live-classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => null) as ActionResult | null;
  if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Live class action failed.");
  return result;
}

function sessionState(session: AdminLiveSessionItem, batchStatus: AdminLiveBatchItem["status"]): string {
  if (batchStatus !== "ACTIVE" || session.status !== "PUBLISHED") return "NOT PUBLIC";
  const now = Date.now(); const starts = new Date(session.startsAt).getTime(); const ends = starts + session.durationSeconds * 1000;
  if (now < starts) return "UPCOMING"; if (now < ends) return "LIVE"; return "ENDED";
}

export function AdminLiveClassManager({ batches, media, publicBaseUrl }: { batches: AdminLiveBatchItem[]; media: AdminLiveMediaItem[]; publicBaseUrl: string; }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<AdminLiveBatchItem["viewerDisplayMode"]>("CONFIGURED_BASELINE");
  const [timelineFormat, setTimelineFormat] = useState<"csv" | "text">("text");
  const readyMedia = useMemo(() => media.filter((item) => item.status === "READY"), [media]);

  async function run(task: () => Promise<ActionResult>, success: string) {
    setBusy(true); setMessage(null);
    try { const result = await task(); setMessage(result.errors?.length ? `${success} ${result.errors.length} warning(s).` : success); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); }
    finally { setBusy(false); }
  }

  async function createBatch(formData: FormData) {
    await run(() => postAction({ action: "createBatch", title: String(formData.get("title") ?? ""), slug: String(formData.get("slug") ?? ""), description: String(formData.get("description") ?? ""), expectedViewerBaseline: Number(formData.get("expectedViewerBaseline") ?? 0), viewerDisplayMode: viewerMode, endedMessage: String(formData.get("endedMessage") ?? ""), endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? ""), notificationDestination: String(formData.get("notificationDestination") ?? "") }), "Live class created as DRAFT. Add a PUBLISHED session, then Activate the batch to make its public page available.");
  }

  async function createSession(batchId: string, formData: FormData) {
    await run(() => postAction({ action: "createSession", batchId, title: String(formData.get("title") ?? ""), position: Number(formData.get("position") ?? 1), startsAt: new Date(String(formData.get("startsAt") ?? "")).toISOString(), durationSeconds: Number(formData.get("durationMinutes") ?? 60) * 60, mediaAssetId: String(formData.get("mediaAssetId") ?? "") || null, status: "PUBLISHED", ctaText: String(formData.get("ctaText") ?? ""), ctaUrl: String(formData.get("ctaUrl") ?? ""), ctaRevealOffsetSeconds: Number(formData.get("ctaRevealMinutes") ?? 0) * 60, endedMessage: String(formData.get("endedMessage") ?? ""), endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? "") }), "Session added as PUBLISHED.");
  }

  async function editBatch(batch: AdminLiveBatchItem) {
    const title = window.prompt("Live class title", batch.title)?.trim(); if (!title) return;
    const slug = window.prompt("Public slug", batch.slug)?.trim(); if (!slug) return;
    const description = window.prompt("Description", batch.description ?? ""); if (description === null) return;
    const baselineRaw = window.prompt("Expected viewer baseline", String(batch.expectedViewerBaseline)); if (baselineRaw === null) return;
    await run(() => postAction({ action: "updateBatch", batchId: batch.id, title, slug, description, expectedViewerBaseline: Number(baselineRaw), viewerDisplayMode: batch.viewerDisplayMode, endedMessage: batch.endedMessage ?? "", endedRedirectUrl: batch.endedRedirectUrl ?? "", notificationDestination: batch.notificationDestination ?? "" }), "Live class updated.");
  }

  async function deleteBatch(batch: AdminLiveBatchItem) {
    if (!window.confirm(`Delete live class “${batch.title}” and all of its sessions, staged chat and attendee records?`)) return;
    await run(() => postAction({ action: "deleteBatch", batchId: batch.id }), "Live class deleted.");
  }

  async function editSession(session: AdminLiveSessionItem) {
    const title = window.prompt("Session title", session.title)?.trim(); if (!title) return;
    const positionRaw = window.prompt("Day/position (1-3)", String(session.position)); if (positionRaw === null) return;
    const startsAtRaw = window.prompt("Start time (ISO date/time)", new Date(session.startsAt).toISOString()); if (!startsAtRaw) return;
    const durationRaw = window.prompt("Duration in minutes", String(Math.round(session.durationSeconds / 60))); if (durationRaw === null) return;
    const mediaAssetId = window.prompt("Media asset ID (blank for no media)", session.mediaAssetId ?? ""); if (mediaAssetId === null) return;
    await run(() => postAction({ action: "updateSession", sessionId: session.id, title, position: Number(positionRaw), startsAt: new Date(startsAtRaw).toISOString(), durationSeconds: Number(durationRaw) * 60, mediaAssetId: mediaAssetId || null, ctaText: session.ctaText ?? "", ctaUrl: session.ctaUrl ?? "", ctaRevealOffsetSeconds: session.ctaRevealOffsetSeconds ?? 0, endedMessage: null, endedRedirectUrl: null }), "Live session updated.");
  }

  async function deleteSession(session: AdminLiveSessionItem) {
    if (!window.confirm(`Delete session “${session.title}” and its synchronized chat/comments?`)) return;
    await run(() => postAction({ action: "deleteSession", sessionId: session.id }), "Live session deleted.");
  }

  async function importTimeline(sessionId: string, formData: FormData) {
    setBusy(true); setMessage(null);
    try { const result = await postAction({ action: "importTimeline", sessionId, format: timelineFormat, content: String(formData.get("timeline") ?? "") }); setMessage(`Imported ${result.imported ?? 0} synchronized chat message(s)${result.errors?.length ? ` with ${result.errors.length} warning(s)` : ""}.`); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Chat import failed."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    {message ? <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{message}</div> : null}

    <Card className="border-blue-500/30 bg-blue-500/[0.03]"><CardHeader><CardTitle className="text-base">Public availability rule</CardTitle><CardDescription>A real public class is available only when the batch is <strong>ACTIVE</strong> and its session is <strong>PUBLISHED</strong>. Before its start it shows UPCOMING, during the scheduled window it shows LIVE, and afterward it shows ENDED.</CardDescription></CardHeader></Card>

    <Card className="border-blue-500/30 bg-blue-500/[0.03]"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TestTube2 className="size-4" /> Test the live room now</CardTitle><CardDescription>Creates an ACTIVE + PUBLISHED 15-minute room immediately.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-3"><label className="space-y-1.5 text-sm"><span className="font-medium">Test viewer count</span><Input id="quick-test-viewers" type="number" min="0" defaultValue="100" /></label><Button disabled={busy} onClick={() => { const element = document.getElementById("quick-test-viewers") as HTMLInputElement | null; void run(() => postAction({ action: "testNow", expectedViewerBaseline: Number(element?.value ?? 100) }), "Live test room created."); }}><Radio className="mr-1.5 size-4" /> Start 15-minute live test</Button></CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Create live class</CardTitle><CardDescription>Creates a DRAFT batch. Add at least one session, then Activate when ready.</CardDescription></CardHeader><CardContent><form action={createBatch} className="grid gap-3 md:grid-cols-2"><Input name="title" required placeholder="September Free Class" /><Input name="slug" placeholder="september-free-class" /><Textarea name="description" className="md:col-span-2" placeholder="Description" /><Input name="expectedViewerBaseline" type="number" min="0" defaultValue="0" /><select className="h-9 rounded-md border bg-background px-3 text-sm" value={viewerMode} onChange={(e) => setViewerMode(e.target.value as AdminLiveBatchItem["viewerDisplayMode"])}><option value="CONFIGURED_BASELINE">Configured audience</option><option value="ACTIVE_ONLY">Active viewers</option><option value="BASELINE_PLUS_ACTIVE">Baseline + active</option></select><Input name="endedMessage" placeholder="After class message" /><Input name="endedRedirectUrl" placeholder="After class redirect URL" /><Input name="notificationDestination" className="md:col-span-2" placeholder="Telegram destination (optional)" /><div className="md:col-span-2"><Button type="submit" disabled={busy}><Plus className="mr-1.5 size-4" /> Create live class</Button></div></form></CardContent></Card>

    {batches.map((batch) => { const publicUrl = `${publicBaseUrl.replace(/\/$/, "")}/live/${encodeURIComponent(batch.slug)}`; return <Card key={batch.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{batch.title}</CardTitle><CardDescription>{batch.status} · {batch.sessions.length}/3 sessions</CardDescription></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl)}><Copy className="mr-1 size-4" /> Copy link</Button><Button size="sm" variant="outline" asChild><a href={publicUrl} target="_blank" rel="noreferrer">View public page</a></Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void editBatch(batch)}>Edit live class</Button>{batch.status === "ACTIVE" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => postAction({ action: "setBatchStatus", batchId: batch.id, status: "DRAFT" }), "Live class deactivated.")}>Deactivate</Button> : <Button size="sm" disabled={busy} onClick={() => void run(() => postAction({ action: "setBatchStatus", batchId: batch.id, status: "ACTIVE" }), "Live class activated; PUBLISHED sessions are now publicly available by schedule.")}>Activate</Button>}<Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteBatch(batch)}>Delete live class</Button></div></div><p className="break-all text-xs text-muted-foreground">{publicUrl}</p></CardHeader><CardContent className="space-y-4">
      {batch.sessions.map((session) => <div key={session.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">Day {session.position}: {session.title}</p><p className="text-xs text-muted-foreground">{new Date(session.startsAt).toLocaleString()} · {Math.round(session.durationSeconds / 60)} min · {session.status} · {sessionState(session, batch.status)}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void editSession(session)}>Edit session</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => postAction({ action: "setSessionStatus", sessionId: session.id, status: session.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }), "Session publishing status updated.")}>{session.status === "PUBLISHED" ? "Unpublish" : "Publish"}</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteSession(session)}>Delete session</Button></div></div><div className="mt-3 rounded-md border p-3"><div className="flex items-center gap-2 text-sm font-medium"><MessageSquareText className="size-4" /> Synchronized chat</div><form action={(formData) => importTimeline(session.id, formData)} className="mt-2 space-y-2"><select className="h-8 rounded-md border bg-background px-2 text-xs" value={timelineFormat} onChange={(e) => setTimelineFormat(e.target.value as "csv" | "text")}><option value="text">Timestamped text</option><option value="csv">CSV</option></select><Textarea name="timeline" rows={3} placeholder="00:00:10 Ada: Good evening" /><Button type="submit" size="sm" variant="outline" disabled={busy}><Upload className="mr-1 size-4" /> Import chat</Button></form></div></div>)}

      {batch.sessions.length < 3 ? <form action={(formData) => createSession(batch.id, formData)} className="grid gap-3 rounded-lg border border-dashed p-4 md:grid-cols-2"><p className="font-medium md:col-span-2">Add PUBLISHED session</p><Input name="title" required placeholder="Day 1 — Foundation" /><Input name="position" required type="number" min="1" max="3" defaultValue={batch.sessions.length + 1} /><Input name="startsAt" type="datetime-local" required /><Input name="durationMinutes" type="number" min="1" defaultValue="60" required /><select name="mediaAssetId" className="h-9 rounded-md border bg-background px-3 text-sm md:col-span-2"><option value="">No media</option>{readyMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.sourceType}</option>)}</select><Input name="ctaText" placeholder="CTA text" /><Input name="ctaUrl" placeholder="CTA URL" /><Input name="ctaRevealMinutes" type="number" min="0" defaultValue="0" /><Input name="endedMessage" placeholder="Ended message" /><Input name="endedRedirectUrl" className="md:col-span-2" placeholder="Ended redirect URL" /><div className="md:col-span-2"><Button type="submit" size="sm" disabled={busy}><Plus className="mr-1 size-4" /> Add session</Button></div></form> : null}

      <div className="rounded-lg border bg-muted/10 p-4"><div className="mb-2 flex items-center gap-2"><Inbox className="size-4" /><span className="font-medium">Attendee inbox</span><span className="text-xs text-muted-foreground">{batch.attendeeMessages.length} message(s)</span></div>{batch.attendeeMessages.length ? <div className="space-y-2">{batch.attendeeMessages.map((item) => <div key={item.id} className="rounded-md bg-background p-3 text-sm"><div className="flex justify-between gap-3"><strong>{item.displayName || "Attendee"}</strong><span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span></div><p className="mt-1">{item.message}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No attendee comments yet.</p>}</div>
    </CardContent></Card>; })}
  </div>;
}
