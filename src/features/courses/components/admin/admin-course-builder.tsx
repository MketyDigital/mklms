"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CourseStructure, LessonCompletionMode, LessonStatus } from "@/features/courses/domain/model";

interface MediaOption { id: string; title: string; sourceType: string; durationSeconds?: number | null; status: string; }
interface AdminCourseBuilderProps { course: CourseStructure; mediaAssets: MediaOption[]; }

export function AdminCourseBuilder({ course, mediaAssets }: AdminCourseBuilderProps) {
  const router = useRouter();
  const readyMedia = useMemo(() => mediaAssets.filter((asset) => asset.status === "READY"), [mediaAssets]);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [lessonModuleId, setLessonModuleId] = useState(course.modules[0]?.id ?? "");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [mediaAssetId, setMediaAssetId] = useState("");
  const [completionMode, setCompletionMode] = useState<LessonCompletionMode>("VIDEO_PROGRESS");
  const [completionThresholdPercent, setCompletionThresholdPercent] = useState(90);
  const [durationSeconds, setDurationSeconds] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function selectMedia(assetId: string) {
    setMediaAssetId(assetId);
    const asset = readyMedia.find((item) => item.id === assetId);
    if (asset?.durationSeconds) setDurationSeconds(asset.durationSeconds);
  }

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.message ?? "The change could not be saved.");
    return result;
  }

  async function addModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const result = await request(`/api/admin/courses/${course.id}/modules`, "POST", { title: moduleTitle, description: moduleDescription || undefined });
      setModuleTitle(""); setModuleDescription(""); setLessonModuleId(result.module.id); setMessage("Module added."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add module."); } finally { setBusy(false); }
  }

  async function addLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lessonModuleId) { setMessage("Create a module before adding lessons."); return; }
    if (completionMode === "VIDEO_PROGRESS" && (!mediaAssetId || !durationSeconds)) { setMessage("Video-progress lessons require a media asset and video duration."); return; }
    setBusy(true); setMessage(null);
    try {
      await request(`/api/admin/modules/${lessonModuleId}/lessons`, "POST", {
        title: lessonTitle, description: lessonDescription || undefined, mediaAssetId: mediaAssetId || undefined,
        completionMode, completionThresholdPercent: completionMode === "VIDEO_PROGRESS" ? completionThresholdPercent : 100,
        durationSeconds: completionMode === "VIDEO_PROGRESS" && durationSeconds ? Number(durationSeconds) : undefined,
      });
      setLessonTitle(""); setLessonDescription(""); setMediaAssetId(""); setDurationSeconds(""); setMessage("Lesson added as draft."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add lesson."); } finally { setBusy(false); }
  }

  async function setLessonStatus(lessonId: string, status: LessonStatus) {
    setBusy(true); setMessage(null);
    try { await request(`/api/admin/lessons/${lessonId}/status`, "PATCH", { status }); setMessage(status === "PUBLISHED" ? "Lesson published." : "Lesson returned to draft."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update lesson publishing status."); }
    finally { setBusy(false); }
  }

  async function editModule(courseModule: CourseStructure["modules"][number]) {
    const title = window.prompt("Module title", courseModule.title)?.trim(); if (!title) return;
    const description = window.prompt("Module description", courseModule.description ?? ""); if (description === null) return;
    setBusy(true); setMessage(null);
    try { await request(`/api/admin/modules/${courseModule.id}`, "PATCH", { title, description: description || null }); setMessage("Module updated."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not edit module."); }
    finally { setBusy(false); }
  }

  async function deleteModule(courseModule: CourseStructure["modules"][number]) {
    if (!window.confirm(`Delete module “${courseModule.title}” and its lessons? Modules with student progress are protected.`)) return;
    setBusy(true); setMessage(null);
    try { await request(`/api/admin/modules/${courseModule.id}`, "DELETE"); setMessage("Module deleted."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete module."); }
    finally { setBusy(false); }
  }

  async function editLesson(lesson: CourseStructure["modules"][number]["lessons"][number]) {
    const title = window.prompt("Lesson title", lesson.title)?.trim(); if (!title) return;
    const description = window.prompt("Lesson description", lesson.description ?? ""); if (description === null) return;
    let nextMedia = lesson.mediaAssetId ?? "";
    let nextDuration = lesson.durationSeconds ?? null;
    let nextThreshold = lesson.completionThresholdPercent;
    if (lesson.completionMode === "VIDEO_PROGRESS") {
      const media = window.prompt("Media asset ID (copy from Media Library if changing it)", nextMedia); if (media === null) return; nextMedia = media.trim();
      const duration = window.prompt("Duration in seconds", String(nextDuration ?? "")); if (duration === null) return; nextDuration = Number(duration);
      const threshold = window.prompt("Completion threshold %", String(nextThreshold)); if (threshold === null) return; nextThreshold = Number(threshold);
    }
    setBusy(true); setMessage(null);
    try {
      await request(`/api/admin/lessons/${lesson.id}`, "PATCH", {
        title, description: description || null, mediaAssetId: nextMedia || null, completionMode: lesson.completionMode,
        completionThresholdPercent: nextThreshold, durationSeconds: nextDuration,
      });
      setMessage("Lesson updated."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not edit lesson."); }
    finally { setBusy(false); }
  }

  async function deleteLesson(lesson: CourseStructure["modules"][number]["lessons"][number]) {
    if (!window.confirm(`Delete lesson “${lesson.title}”? Lessons with student progress are protected.`)) return;
    setBusy(true); setMessage(null);
    try { await request(`/api/admin/lessons/${lesson.id}`, "DELETE"); setMessage("Lesson deleted."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete lesson."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-lg border bg-muted/40 p-4 text-sm">{message}</div> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Add module</CardTitle><CardDescription>Modules are ordered automatically in the sequence they are created.</CardDescription></CardHeader><CardContent>
          <form onSubmit={addModule} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="module-title">Module title</Label><Input id="module-title" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="module-description">Description</Label><Textarea id="module-description" value={moduleDescription} onChange={(e) => setModuleDescription(e.target.value)} /></div>
            <Button type="submit" disabled={busy}>Add module</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Add lesson</CardTitle><CardDescription>Select a reusable media record instead of pasting origin URLs.</CardDescription></CardHeader><CardContent>
          <form onSubmit={addLesson} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="lesson-module">Module</Label><select id="lesson-module" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={lessonModuleId} onChange={(e) => setLessonModuleId(e.target.value)} required><option value="" disabled>Select module</option>{course.modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="lesson-title">Lesson title</Label><Input id="lesson-title" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="lesson-description">Description</Label><Textarea id="lesson-description" value={lessonDescription} onChange={(e) => setLessonDescription(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="completion-mode">Completion method</Label><select id="completion-mode" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={completionMode} onChange={(e) => setCompletionMode(e.target.value as LessonCompletionMode)}><option value="VIDEO_PROGRESS">Automatic from protected video progress</option><option value="MANUAL">Student marks lesson complete</option><option value="CUSTOM">Custom learning activity</option></select></div>
            <div className="space-y-2"><Label htmlFor="media-asset">Media asset</Label><select id="media-asset" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={mediaAssetId} onChange={(e) => selectMedia(e.target.value)} required={completionMode === "VIDEO_PROGRESS"}><option value="">No media</option>{readyMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.sourceType}</option>)}</select><p className="text-xs text-muted-foreground"><Link className="underline" href="/admin/media">Open Media Library</Link></p></div>
            {completionMode === "VIDEO_PROGRESS" ? <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="duration-seconds">Duration (seconds)</Label><Input id="duration-seconds" type="number" min="1" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value ? Number(e.target.value) : "")} required /></div><div className="space-y-2"><Label htmlFor="completion-threshold">Completion threshold %</Label><Input id="completion-threshold" type="number" min="1" max="100" value={completionThresholdPercent} onChange={(e) => setCompletionThresholdPercent(Number(e.target.value))} required /></div></div> : null}
            <Button type="submit" disabled={busy || !course.modules.length}>Add lesson</Button>
          </form>
        </CardContent></Card>
      </div>
      <div className="space-y-4">
        {course.modules.map((courseModule, moduleIndex) => (
          <Card key={courseModule.id}>
            <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-base">Module {moduleIndex + 1}: {courseModule.title}</CardTitle>{courseModule.description ? <CardDescription>{courseModule.description}</CardDescription> : null}</div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void editModule(courseModule)}>Edit module</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteModule(courseModule)}>Delete module</Button></div></div></CardHeader>
            <CardContent className="space-y-2">
              {courseModule.lessons.map((lesson, lessonIndex) => (
                <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <div><p className="text-sm font-medium">Lesson {lessonIndex + 1}: {lesson.title}</p><p className="mt-1 text-xs text-muted-foreground">{lesson.completionMode}{lesson.durationSeconds ? ` · ${lesson.durationSeconds}s` : ""}{lesson.mediaAssetId ? ` · media ${lesson.mediaAssetId}` : " · no media"}</p></div>
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{lesson.status}</Badge><Button size="sm" variant="outline" disabled={busy} onClick={() => void editLesson(lesson)}>Edit lesson</Button>{lesson.status === "PUBLISHED" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void setLessonStatus(lesson.id, "DRAFT")}>Unpublish</Button> : <Button size="sm" disabled={busy} onClick={() => void setLessonStatus(lesson.id, "PUBLISHED")}>Publish</Button>}<Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteLesson(lesson)}>Delete lesson</Button></div>
                </div>
              ))}
              {!courseModule.lessons.length ? <p className="py-4 text-sm text-muted-foreground">No lessons in this module yet.</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
