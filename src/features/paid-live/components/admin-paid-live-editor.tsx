"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PaidCourseLiveSession, PaidLiveDeliveryMode, PaidLiveStatus } from "../domain/model";

interface MediaOption { id: string; title: string; status: string; }

function localDateTimeValue(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function canPublish(session: PaidCourseLiveSession): boolean {
  return session.deliveryMode === "ZOOM" ? Boolean(session.zoomUrl) : Boolean(session.mediaAssetId);
}

export function AdminPaidLiveEditor({
  courseId,
  sessions,
  mediaAssets,
}: {
  courseId: string;
  sessions: PaidCourseLiveSession[];
  mediaAssets: MediaOption[];
}) {
  const router = useRouter();
  const readyMedia = mediaAssets.filter((asset) => asset.status === "READY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<PaidLiveDeliveryMode>("MEDIA");
  const [mediaAssetId, setMediaAssetId] = useState("");
  const [zoomUrl, setZoomUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDeliveryMode, setEditDeliveryMode] = useState<PaidLiveDeliveryMode>("MEDIA");
  const [editMediaAssetId, setEditMediaAssetId] = useState("");
  const [editZoomUrl, setEditZoomUrl] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function api(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "The paid live change could not be saved.");
  }

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      await api(`/api/admin/courses/${courseId}/paid-live`, "POST", {
        title,
        description: description || null,
        deliveryMode,
        mediaAssetId: deliveryMode === "MEDIA" ? mediaAssetId || null : null,
        zoomUrl: deliveryMode === "ZOOM" ? zoomUrl || null : null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setTitle(""); setDescription(""); setDeliveryMode("MEDIA"); setMediaAssetId(""); setZoomUrl(""); setStartsAt(""); setEndsAt("");
      setMessage("Paid live session created as draft."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create paid live session."); }
    finally { setBusy(false); }
  }

  function beginEdit(session: PaidCourseLiveSession) {
    setEditingId(session.id); setEditTitle(session.title); setEditDescription(session.description ?? "");
    setEditDeliveryMode(session.deliveryMode); setEditMediaAssetId(session.mediaAssetId ?? ""); setEditZoomUrl(session.zoomUrl ?? "");
    setEditStartsAt(localDateTimeValue(session.startsAt)); setEditEndsAt(localDateTimeValue(session.endsAt));
  }

  async function save(session: PaidCourseLiveSession, status: PaidLiveStatus = session.status) {
    setBusy(true); setMessage(null);
    try {
      const mode = editingId === session.id ? editDeliveryMode : session.deliveryMode;
      await api(`/api/admin/paid-live/${session.id}`, "PATCH", {
        title: editingId === session.id ? editTitle : session.title,
        description: editingId === session.id ? editDescription || null : session.description ?? null,
        deliveryMode: mode,
        mediaAssetId: mode === "MEDIA" ? (editingId === session.id ? editMediaAssetId || null : session.mediaAssetId ?? null) : null,
        zoomUrl: mode === "ZOOM" ? (editingId === session.id ? editZoomUrl || null : session.zoomUrl ?? null) : null,
        startsAt: editingId === session.id ? new Date(editStartsAt).toISOString() : session.startsAt.toISOString(),
        endsAt: editingId === session.id ? new Date(editEndsAt).toISOString() : session.endsAt.toISOString(),
        status,
      });
      setEditingId(null); setMessage("Paid live session updated."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update paid live session."); }
    finally { setBusy(false); }
  }

  async function remove(session: PaidCourseLiveSession) {
    if (!window.confirm(`Delete paid live session “${session.title}”?`)) return;
    setBusy(true); setMessage(null);
    try { await api(`/api/admin/paid-live/${session.id}`, "DELETE"); setMessage("Paid live session deleted."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete paid live session."); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paid course live sessions</CardTitle>
        <CardDescription>Separate from the public free webinar feature. Create either protected scheduled video or a simple Zoom live class; only authenticated students enrolled in this course can enter.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {message ? <div className="rounded-lg border bg-muted/30 p-3 text-sm">{message}</div> : null}
        <form onSubmit={createSession} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-1"><Label>Live type</Label><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as PaidLiveDeliveryMode)}><option value="MEDIA">Scheduled video</option><option value="ZOOM">Zoom live</option></select></div>
          {deliveryMode === "MEDIA" ? <div className="space-y-1 md:col-span-2"><Label>Protected media</Label><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={mediaAssetId} onChange={(e) => setMediaAssetId(e.target.value)}><option value="">Select when ready</option>{readyMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select></div> : <div className="space-y-1 md:col-span-2"><Label>Zoom meeting or webinar link</Label><Input type="url" placeholder="https://zoom.us/j/..." value={zoomUrl} onChange={(e) => setZoomUrl(e.target.value)} /></div>}
          <div className="space-y-1"><Label>Start</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required /></div>
          <div className="space-y-1"><Label>End</Label><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required /></div>
          <div className="space-y-1 md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="md:col-span-2"><Button type="submit" disabled={busy}>Create paid live session</Button></div>
        </form>

        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-lg border p-4">
              {editingId === session.id ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="Paid live title" />
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={editDeliveryMode} onChange={(e) => setEditDeliveryMode(e.target.value as PaidLiveDeliveryMode)}><option value="MEDIA">Scheduled video</option><option value="ZOOM">Zoom live</option></select>
                  {editDeliveryMode === "MEDIA" ? <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm md:col-span-2" value={editMediaAssetId} onChange={(e) => setEditMediaAssetId(e.target.value)}><option value="">No media</option>{readyMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select> : <Input className="md:col-span-2" type="url" placeholder="https://zoom.us/j/..." value={editZoomUrl} onChange={(e) => setEditZoomUrl(e.target.value)} />}
                  <Input type="datetime-local" value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)} />
                  <Input type="datetime-local" value={editEndsAt} onChange={(e) => setEditEndsAt(e.target.value)} />
                  <Textarea className="md:col-span-2" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                  <div className="flex gap-2 md:col-span-2"><Button size="sm" disabled={busy} onClick={() => void save(session)}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button></div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><p className="font-medium">{session.title}</p><Badge variant="outline">{session.status}</Badge><Badge variant="secondary">{session.deliveryMode === "ZOOM" ? "Zoom" : "Video"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{session.startsAt.toLocaleString()} → {session.endsAt.toLocaleString()}</p></div>
                  <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => beginEdit(session)}>Edit</Button>{session.status === "PUBLISHED" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void save(session, "DRAFT")}>Unpublish</Button> : <Button size="sm" disabled={busy || !canPublish(session)} onClick={() => void save(session, "PUBLISHED")}>Publish</Button>}<Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(session)}>Delete</Button></div>
                </div>
              )}
            </div>
          ))}
          {!sessions.length ? <p className="text-sm text-muted-foreground">No paid course live sessions yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
