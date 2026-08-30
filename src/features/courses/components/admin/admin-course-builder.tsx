"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CourseStructure } from "@/features/courses/domain/model";

interface AdminCourseBuilderProps {
  course: CourseStructure;
}

export function AdminCourseBuilder({ course }: AdminCourseBuilderProps) {
  const router = useRouter();
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [lessonModuleId, setLessonModuleId] = useState(course.modules[0]?.id ?? "");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [mediaAssetId, setMediaAssetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
          completionMode: "VIDEO_PROGRESS",
          completionThresholdPercent: 90,
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
      setMessage("Lesson added.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">{message}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add module</CardTitle>
            <CardDescription>
              Modules are ordered automatically in the sequence they are created.
            </CardDescription>
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
              The media field stores only a generic media asset ID. Playback URLs are issued later by the configured media provider.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addLesson} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lesson-module">Module</Label>
                <select
                  id="lesson-module"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={lessonModuleId}
                  onChange={(event) => setLessonModuleId(event.target.value)}
                  required
                >
                  <option value="" disabled>Select module</option>
                  {course.modules.map((module) => (
                    <option key={module.id} value={module.id}>{module.title}</option>
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
                <Label htmlFor="media-asset">Media asset ID</Label>
                <Input id="media-asset" value={mediaAssetId} onChange={(event) => setMediaAssetId(event.target.value)} placeholder="Optional until media is uploaded" />
              </div>
              <Button type="submit" disabled={busy || !course.modules.length}>Add lesson</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {course.modules.map((module, moduleIndex) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="text-base">
                Module {moduleIndex + 1}: {module.title}
              </CardTitle>
              {module.description ? <CardDescription>{module.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="space-y-2">
              {module.lessons.map((lesson, lessonIndex) => (
                <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Lesson {lessonIndex + 1}: {lesson.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lesson.mediaAssetId ? `Media asset: ${lesson.mediaAssetId}` : "No media asset assigned"}
                    </p>
                  </div>
                  <Badge variant="outline">{lesson.status}</Badge>
                </div>
              ))}
              {!module.lessons.length ? (
                <p className="py-4 text-sm text-muted-foreground">No lessons in this module yet.</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
