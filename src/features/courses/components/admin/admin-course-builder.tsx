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

interface MediaOption {
  id: string;
  title: string;
  sourceType: string;
  durationSeconds?: number | null;
  status: string;
}

interface AdminCourseBuilderProps {
  course: CourseStructure;
  mediaAssets: MediaOption[];
}

export function AdminCourseBuilder({ course, mediaAssets }: AdminCourseBuilderProps) {
  const router = useRouter();
  const readyMedia = useMemo(
    () => mediaAssets.filter((asset) => asset.status === "READY"),
    [mediaAssets],
  );
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

  async function addModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/courses/${course.id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: moduleTitle,
          description: moduleDescription || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "Could not add module.");
        return;
      }
      setModuleTitle("");
      setModuleDescription("");
      setLessonModuleId(result.module.id);
      setMessage("Module added.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lessonModuleId) {
      setMessage("Create a module before adding lessons.");
      return;
    }
    if (completionMode === "VIDEO_PROGRESS" && (!mediaAssetId || !durationSeconds)) {
      setMessage("Video-progress lessons require a media asset and video duration.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/modules/${lessonModuleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: lessonTitle,
          description: lessonDescription || undefined,
          mediaAssetId: mediaAssetId || undefined,
          completionMode,
          completionThresholdPercent:
            completionMode === "VIDEO_PROGRESS" ? completionThresholdPercent : 100,
          durationSeconds:
            completionMode === "VIDEO_PROGRESS" && durationSeconds ? Number(durationSeconds) : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "Could not add lesson.");
        return;
      }
      setLessonTitle("");
      setLessonDescription("");
      setMediaAssetId("");
      setDurationSeconds("");
      setMessage("Lesson added as draft.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setLessonStatus(lessonId: string, status: LessonStatus) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/lessons/${lessonId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setMessage("Could not update lesson publishing status.");
        return;
      }
      setMessage(status === "PUBLISHED" ? "Lesson published." : "Lesson returned to draft.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-lg border bg-muted/40 p-4 text-sm">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add module</CardTitle>
            <CardDescription>Modules are ordered automatically in the sequence they are created.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addModule} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="module-title">Module title</Label>
                <Input id="module-title" value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-description">Description</Label>
                <Textarea id="module-description" value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} />
              </div>
              <Button type="submit" disabled={busy}>Add module</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add lesson</CardTitle>
            <CardDescription>
              Select a reusable media record instead of pasting origin URLs. Create media first in the Media Library when needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addLesson} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lesson-module">Module</Label>
                <select id="lesson-module" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs" value={lessonModuleId} onChange={(event) => setLessonModuleId(event.target.value)} required>
                  <option value="" disabled>Select module</option>
                  {course.modules.map((courseModule) => (
                    <option key={courseModule.id} value={courseModule.id}>{courseModule.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson-title">Lesson title</Label>
                <Input id="lesson-title" value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson-description">Description</Label>
                <Textarea id="lesson-description" value={lessonDescription} onChange={(event) => setLessonDescription(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completion-mode">Completion method</Label>
                <select id="completion-mode" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs" value={completionMode} onChange={(event) => setCompletionMode(event.target.value as LessonCompletionMode)}>
                  <option value="VIDEO_PROGRESS">Automatic from protected video progress</option>
                  <option value="MANUAL">Student marks lesson complete</option>
                  <option value="CUSTOM">Custom learning activity</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-asset">Media asset</Label>
                <select id="media-asset" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs" value={mediaAssetId} onChange={(event) => selectMedia(event.target.value)} required={completionMode === "VIDEO_PROGRESS"}>
                  <option value="">No media</option>
                  {readyMedia.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.title} · {asset.sourceType}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  <Link className="underline underline-offset-2" href="/admin/media">Open Media Library</Link>
                </p>
              </div>
              {completionMode === "VIDEO_PROGRESS" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="duration-seconds">Duration (seconds)</Label>
                    <Input id="duration-seconds" type="number" min="1" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value ? Number(event.target.value) : "")} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="completion-threshold">Completion threshold %</Label>
                    <Input id="completion-threshold" type="number" min="1" max="100" value={completionThresholdPercent} onChange={(event) => setCompletionThresholdPercent(Number(event.target.value))} required />
                  </div>
                </div>
              ) : null}
              <Button type="submit" disabled={busy || !course.modules.length}>Add lesson</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {course.modules.map((courseModule, moduleIndex) => (
          <Card key={courseModule.id}>
            <CardHeader>
              <CardTitle className="text-base">Module {moduleIndex + 1}: {courseModule.title}</CardTitle>
              {courseModule.description ? <CardDescription>{courseModule.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="space-y-2">
              {courseModule.lessons.map((lesson, lessonIndex) => (
                <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Lesson {lessonIndex + 1}: {lesson.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lesson.completionMode}{lesson.durationSeconds ? ` · ${lesson.durationSeconds}s` : ""}{lesson.mediaAssetId ? ` · media ${lesson.mediaAssetId}` : " · no media"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{lesson.status}</Badge>
                    {lesson.status === "PUBLISHED" ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setLessonStatus(lesson.id, "DRAFT")}>Unpublish</Button>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => setLessonStatus(lesson.id, "PUBLISHED")}>Publish</Button>
                    )}
                  </div>
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
