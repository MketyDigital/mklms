"use client";

import { useMemo, useState } from "react";
import { Copy, Inbox, MessageSquareText, Plus, Radio, RefreshCw, TestTube2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface AdminLiveAttendeeMessageItem {
  id: string;
  sessionId?: string | null;
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
  endedMessage?: string | null;
  endedRedirectUrl?: string | null;
  timelineCount?: number;
  timelineFirstOffsetSeconds?: number | null;
  timelineLastOffsetSeconds?: number | null;
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
  stored?: number;
  summary?: {
    count: number;
    firstOffsetSeconds: number | null;
    lastOffsetSeconds: number | null;
  };
  errors?: Array<{ line: number; message: string }>;
}

async function postAction(payload: Record<string, unknown>): Promise<ActionResult> {
  const response = await fetch("/api/admin/live-classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null) as ActionResult | null;
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message ?? "Live class action failed.");
  }
  return result;
}

function sessionState(
  session: AdminLiveSessionItem,
  batchStatus: AdminLiveBatchItem["status"],
): string {
  if (batchStatus !== "ACTIVE" || session.status !== "PUBLISHED") return "NOT PUBLIC";
  const now = Date.now();
  const starts = new Date(session.startsAt).getTime();
  const ends = starts + session.durationSeconds * 1000;
  if (now < starts) return "UPCOMING";
  if (now < ends) return "LIVE";
  return "ENDED";
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatOffset(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ViewerModeSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: AdminLiveBatchItem["viewerDisplayMode"];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
    >
      <option value="CONFIGURED_BASELINE">Configured audience</option>
      <option value="ACTIVE_ONLY">Active viewers only</option>
      <option value="BASELINE_PLUS_ACTIVE">Baseline + active viewers</option>
    </select>
  );
}

function MediaSelect({
  name,
  readyMedia,
  defaultValue,
}: {
  name: string;
  readyMedia: AdminLiveMediaItem[];
  defaultValue?: string | null;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
    >
      <option value="">No media</option>
      {readyMedia.map((asset) => (
        <option key={asset.id} value={asset.id}>
          {asset.title} · {asset.sourceType}
        </option>
      ))}
    </select>
  );
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
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const readyMedia = useMemo(
    () => media.filter((item) => item.status === "READY"),
    [media],
  );

  async function run(task: () => Promise<ActionResult>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      setMessage(
        result.errors?.length
          ? `${success} ${result.errors.length} warning(s).`
          : success,
      );
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
        viewerDisplayMode: String(formData.get("viewerDisplayMode") ?? "CONFIGURED_BASELINE"),
        endedMessage: String(formData.get("endedMessage") ?? ""),
        endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? ""),
        notificationDestination: String(formData.get("notificationDestination") ?? ""),
      }),
      "Live class created as DRAFT. Add a PUBLISHED session, then Activate the batch to make its public page available.",
    );
  }

  async function updateBatch(batchId: string, formData: FormData) {
    await run(
      () => postAction({
        action: "updateBatch",
        batchId,
        title: String(formData.get("title") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        description: String(formData.get("description") ?? ""),
        expectedViewerBaseline: Number(formData.get("expectedViewerBaseline") ?? 0),
        viewerDisplayMode: String(formData.get("viewerDisplayMode") ?? "CONFIGURED_BASELINE"),
        endedMessage: String(formData.get("endedMessage") ?? ""),
        endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? ""),
        notificationDestination: String(formData.get("notificationDestination") ?? ""),
      }),
      "Live class updated.",
    );
    setEditingBatchId(null);
  }

  async function createSession(batchId: string, formData: FormData) {
    await run(
      () => postAction({
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
      }),
      "Session added as PUBLISHED.",
    );
  }

  async function updateSession(sessionId: string, formData: FormData) {
    await run(
      () => postAction({
        action: "updateSession",
        sessionId,
        title: String(formData.get("title") ?? ""),
        position: Number(formData.get("position") ?? 1),
        startsAt: new Date(String(formData.get("startsAt") ?? "")).toISOString(),
        durationSeconds: Number(formData.get("durationMinutes") ?? 60) * 60,
        mediaAssetId: String(formData.get("mediaAssetId") ?? "") || null,
        ctaText: String(formData.get("ctaText") ?? ""),
        ctaUrl: String(formData.get("ctaUrl") ?? ""),
        ctaRevealOffsetSeconds: Number(formData.get("ctaRevealMinutes") ?? 0) * 60,
        endedMessage: String(formData.get("endedMessage") ?? ""),
        endedRedirectUrl: String(formData.get("endedRedirectUrl") ?? ""),
      }),
      "Live session updated.",
    );
    setEditingSessionId(null);
  }

  async function deleteBatch(batch: AdminLiveBatchItem) {
    if (!window.confirm(
      `Delete live class “${batch.title}” and all of its sessions, imported chat, viewer records and attendee comments?`,
    )) return;
    await run(
      () => postAction({ action: "deleteBatch", batchId: batch.id }),
      "Live class deleted.",
    );
  }

  async function deleteSession(session: AdminLiveSessionItem) {
    if (!window.confirm(
      `Delete session “${session.title}” and its synchronized chat/comments?`,
    )) return;
    await run(
      () => postAction({ action: "deleteSession", sessionId: session.id }),
      "Live session deleted.",
    );
  }

  async function importTimeline(sessionId: string, formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const format = String(formData.get("timelineFormat") ?? "text") === "csv" ? "csv" : "text";
      const firstMessageAtMinutesRaw = String(formData.get("firstMessageAtMinutes") ?? "").trim();
      const firstMessageAtSeconds = firstMessageAtMinutesRaw
        ? Math.round(Number(firstMessageAtMinutesRaw) * 60)
        : null;
      const result = await postAction({
        action: "importTimeline",
        sessionId,
        format,
        content: String(formData.get("timeline") ?? ""),
        firstMessageAtSeconds,
      });
      setMessage(
        `Parsed ${result.imported ?? 0} synchronized chat message(s). Confirmed stored ${result.stored ?? 0} in the database${
          result.summary?.count
            ? ` from ${formatOffset(result.summary.firstOffsetSeconds)} to ${formatOffset(result.summary.lastOffsetSeconds)}`
            : ""
        }${result.errors?.length ? ` with ${result.errors.length} warning(s)` : ""}.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chat import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{message}</div>
      ) : null}

      <Card className="border-blue-500/30 bg-blue-500/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Public availability rule</CardTitle>
          <CardDescription>
            A real public class is available only when the live class is <strong>ACTIVE</strong> and its session is <strong>PUBLISHED</strong>. Before its start it shows UPCOMING, during the scheduled window it shows LIVE, and afterward it shows ENDED.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-blue-500/30 bg-blue-500/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TestTube2 className="size-4" /> Test the live room now
          </CardTitle>
          <CardDescription>Creates an ACTIVE + PUBLISHED 15-minute room immediately.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field label="Test viewer count">
            <Input id="quick-test-viewers" type="number" min="0" defaultValue="100" />
          </Field>
          <Button
            disabled={busy}
            onClick={() => {
              const element = document.getElementById("quick-test-viewers") as HTMLInputElement | null;
              void run(
                () => postAction({
                  action: "testNow",
                  expectedViewerBaseline: Number(element?.value ?? 100),
                }),
                "Live test room created.",
              );
            }}
          >
            <Radio className="mr-1.5 size-4" /> Start 15-minute live test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create live class</CardTitle>
          <CardDescription>Creates a DRAFT live class. Add at least one session, then Activate when ready.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createBatch} className="grid gap-4 md:grid-cols-2">
            <Field label="Live class title">
              <Input name="title" required placeholder="September Free Class" />
            </Field>
            <Field label="Public slug">
              <Input name="slug" placeholder="september-free-class" />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea name="description" rows={3} />
            </Field>
            <Field label="Expected viewer baseline">
              <Input name="expectedViewerBaseline" type="number" min="0" defaultValue="0" />
            </Field>
            <Field label="Viewer count mode">
              <ViewerModeSelect name="viewerDisplayMode" defaultValue="CONFIGURED_BASELINE" />
            </Field>
            <Field label="After class message">
              <Input name="endedMessage" />
            </Field>
            <Field label="After class redirect URL">
              <Input name="endedRedirectUrl" type="url" placeholder="https://..." />
            </Field>
            <Field label="Admin notification destination" className="md:col-span-2">
              <Input name="notificationDestination" placeholder="Telegram destination (optional)" />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                <Plus className="mr-1.5 size-4" /> Create live class
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {batches.map((batch) => {
        const publicUrl = `${publicBaseUrl.replace(/\/$/, "")}/live/${encodeURIComponent(batch.slug)}`;
        const editingBatch = editingBatchId === batch.id;
        return (
          <Card key={batch.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{batch.title}</CardTitle>
                  <CardDescription>{batch.status} · {batch.sessions.length}/3 sessions</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(publicUrl)}>
                    <Copy className="mr-1 size-4" /> Copy link
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={publicUrl} target="_blank" rel="noreferrer">View public page</a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setEditingBatchId(editingBatch ? null : batch.id)}
                  >
                    {editingBatch ? "Close edit" : "Edit live class"}
                  </Button>
                  {batch.status === "ACTIVE" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run(
                        () => postAction({ action: "setBatchStatus", batchId: batch.id, status: "DRAFT" }),
                        "Live class deactivated.",
                      )}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(
                        () => postAction({ action: "setBatchStatus", batchId: batch.id, status: "ACTIVE" }),
                        "Live class activated; PUBLISHED sessions are now publicly available by schedule.",
                      )}
                    >
                      Activate
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteBatch(batch)}>
                    Delete live class
                  </Button>
                </div>
              </div>
              <p className="break-all text-xs text-muted-foreground">{publicUrl}</p>
            </CardHeader>

            <CardContent className="space-y-4">
              {editingBatch ? (
                <form action={(formData) => updateBatch(batch.id, formData)} className="grid gap-4 rounded-lg border bg-muted/10 p-4 md:grid-cols-2">
                  <p className="font-medium md:col-span-2">Edit live class settings</p>
                  <Field label="Live class title"><Input name="title" defaultValue={batch.title} required /></Field>
                  <Field label="Public slug"><Input name="slug" defaultValue={batch.slug} required /></Field>
                  <Field label="Description" className="md:col-span-2"><Textarea name="description" defaultValue={batch.description ?? ""} rows={3} /></Field>
                  <Field label="Expected viewer baseline"><Input name="expectedViewerBaseline" type="number" min="0" defaultValue={batch.expectedViewerBaseline} /></Field>
                  <Field label="Viewer count mode"><ViewerModeSelect name="viewerDisplayMode" defaultValue={batch.viewerDisplayMode} /></Field>
                  <Field label="After class message"><Input name="endedMessage" defaultValue={batch.endedMessage ?? ""} /></Field>
                  <Field label="After class redirect URL"><Input name="endedRedirectUrl" type="url" defaultValue={batch.endedRedirectUrl ?? ""} /></Field>
                  <Field label="Admin notification destination" className="md:col-span-2"><Input name="notificationDestination" defaultValue={batch.notificationDestination ?? ""} /></Field>
                  <div className="flex gap-2 md:col-span-2">
                    <Button type="submit" size="sm" disabled={busy}>Save live class</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingBatchId(null)}>Cancel</Button>
                  </div>
                </form>
              ) : null}

              {batch.sessions.map((session) => {
                const editingSession = editingSessionId === session.id;
                return (
                  <div key={session.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">Day {session.position}: {session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.startsAt).toLocaleString()} · {Math.round(session.durationSeconds / 60)} min · {session.status} · {sessionState(session, batch.status)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setEditingSessionId(editingSession ? null : session.id)}
                        >
                          {editingSession ? "Close edit" : "Edit session"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void run(
                            () => postAction({
                              action: "setSessionStatus",
                              sessionId: session.id,
                              status: session.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                            }),
                            "Session publishing status updated.",
                          )}
                        >
                          {session.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteSession(session)}>
                          Delete session
                        </Button>
                      </div>
                    </div>

                    {editingSession ? (
                      <form action={(formData) => updateSession(session.id, formData)} className="mt-4 grid gap-4 rounded-md border bg-muted/10 p-4 md:grid-cols-2">
                        <Field label="Session title"><Input name="title" defaultValue={session.title} required /></Field>
                        <Field label="Day / position"><Input name="position" type="number" min="1" max="3" defaultValue={session.position} required /></Field>
                        <Field label="Start date and time"><Input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(session.startsAt)} required /></Field>
                        <Field label="Duration (minutes)"><Input name="durationMinutes" type="number" min="1" defaultValue={Math.round(session.durationSeconds / 60)} required /></Field>
                        <Field label="Video / media" className="md:col-span-2"><MediaSelect name="mediaAssetId" readyMedia={readyMedia} defaultValue={session.mediaAssetId} /></Field>
                        <Field label="CTA text"><Input name="ctaText" defaultValue={session.ctaText ?? ""} /></Field>
                        <Field label="CTA URL"><Input name="ctaUrl" type="url" defaultValue={session.ctaUrl ?? ""} /></Field>
                        <Field label="CTA reveal (minutes)"><Input name="ctaRevealMinutes" type="number" min="0" defaultValue={Math.round((session.ctaRevealOffsetSeconds ?? 0) / 60)} /></Field>
                        <Field label="Session ended message"><Input name="endedMessage" defaultValue={session.endedMessage ?? ""} /></Field>
                        <Field label="Session ended redirect URL" className="md:col-span-2"><Input name="endedRedirectUrl" type="url" defaultValue={session.endedRedirectUrl ?? ""} /></Field>
                        <div className="flex gap-2 md:col-span-2">
                          <Button type="submit" size="sm" disabled={busy}>Save session</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingSessionId(null)}>Cancel</Button>
                        </div>
                      </form>
                    ) : null}

                    <div className="mt-3 rounded-md border p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <MessageSquareText className="size-4" /> Synchronized chat
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Select the original Zoom meeting_saved_chat.txt file when possible. Copy/paste remains available as a fallback. Long or wrapped messages are preserved.
                      </p>
                      <p className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                        <strong>Confirmed stored:</strong> {session.timelineCount ?? 0} message(s) · first {formatOffset(session.timelineFirstOffsetSeconds)} · last {formatOffset(session.timelineLastOffsetSeconds)}
                      </p>
                      <form action={(formData) => importTimeline(session.id, formData)} className="mt-3 space-y-3">
                        <Field label="Upload Zoom TXT / CSV">
                          <Input
                            type="file"
                            accept=".txt,text/plain,.csv,text/csv"
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              if (!file) return;
                              void file.text().then((content) => {
                                if (content.length > 2_000_000) {
                                  setMessage("Chat file is too large. Maximum supported text size is 2,000,000 characters.");
                                  return;
                                }
                                const textarea = document.getElementById(`timeline-${session.id}`) as HTMLTextAreaElement | null;
                                if (textarea) textarea.value = content;
                                const format = document.getElementById(`timeline-format-${session.id}`) as HTMLSelectElement | null;
                                if (format) format.value = file.name.toLowerCase().endsWith(".csv") ? "csv" : "text";
                                setMessage(`Loaded ${file.name}. Review the optional sync calibration, then click Import chat.`);
                              }).catch(() => setMessage("The selected chat file could not be read."));
                            }}
                          />
                        </Field>
                        <Field label="Chat import format">
                          <select id={`timeline-format-${session.id}`} name="timelineFormat" defaultValue="text" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                            <option value="text">Zoom / timestamped text</option>
                            <option value="csv">CSV</option>
                          </select>
                        </Field>
                        <Field label="First imported message appears at video minute (optional)">
                          <Input
                            name="firstMessageAtMinutes"
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="0"
                          />
                        </Field>
                        <p className="text-xs text-muted-foreground">
                          For wall-clock Zoom timestamps, enter where the first chat message occurs in the video if it is not at the beginning. Example: 10 means the first imported chat appears at 10:00 in the video while all later message gaps stay synchronized.
                        </p>
                        <Field label="Chat export / timeline text">
                          <Textarea id={`timeline-${session.id}`} name="timeline" rows={8} placeholder="00:00:10 From Ada to Everyone: Good evening" />
                        </Field>
                        <Button type="submit" size="sm" variant="outline" disabled={busy}>
                          <Upload className="mr-1 size-4" /> Import chat
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}

              {batch.sessions.length < 3 ? (
                <form action={(formData) => createSession(batch.id, formData)} className="grid gap-4 rounded-lg border border-dashed p-4 md:grid-cols-2">
                  <p className="font-medium md:col-span-2">Add PUBLISHED session</p>
                  <Field label="Session title"><Input name="title" required placeholder="Day 1 — Foundation" /></Field>
                  <Field label="Day / position"><Input name="position" required type="number" min="1" max="3" defaultValue={batch.sessions.length + 1} /></Field>
                  <Field label="Start date and time"><Input name="startsAt" type="datetime-local" required /></Field>
                  <Field label="Duration (minutes)"><Input name="durationMinutes" type="number" min="1" defaultValue="60" required /></Field>
                  <Field label="Video / media" className="md:col-span-2"><MediaSelect name="mediaAssetId" readyMedia={readyMedia} /></Field>
                  <Field label="CTA text"><Input name="ctaText" /></Field>
                  <Field label="CTA URL"><Input name="ctaUrl" type="url" /></Field>
                  <Field label="CTA reveal (minutes)"><Input name="ctaRevealMinutes" type="number" min="0" defaultValue="0" /></Field>
                  <Field label="Session ended message"><Input name="endedMessage" /></Field>
                  <Field label="Session ended redirect URL" className="md:col-span-2"><Input name="endedRedirectUrl" type="url" /></Field>
                  <div className="md:col-span-2">
                    <Button type="submit" size="sm" disabled={busy}>
                      <Plus className="mr-1 size-4" /> Add session
                    </Button>
                  </div>
                </form>
              ) : null}

              <div className="rounded-lg border bg-muted/10 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Inbox className="size-4" />
                    <span className="font-medium">Attendee inbox</span>
                    <span className="text-xs text-muted-foreground">{batch.attendeeMessages.length} message(s)</span>
                  </div>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => router.refresh()}>
                    <RefreshCw className="mr-1 size-3.5" /> Refresh comments
                  </Button>
                </div>
                {batch.attendeeMessages.length ? (
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {batch.attendeeMessages.map((item) => {
                      const session = batch.sessions.find((candidate) => candidate.id === item.sessionId);
                      return (
                        <div key={item.id} className="rounded-md bg-background p-3 text-sm">
                          <div className="flex flex-wrap justify-between gap-2">
                            <div>
                              <strong>{item.displayName || "Attendee"}</strong>
                              {session ? <span className="ml-2 text-xs text-muted-foreground">Day {session.position} · {session.title}</span> : null}
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No attendee comments yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
