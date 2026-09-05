"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CourseRecord, CourseStatus } from "@/features/courses/domain/model";

interface AdminCourseManagerProps {
  initialCourses: CourseRecord[];
}

export function AdminCourseManager({ initialCourses }: AdminCourseManagerProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || undefined }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "Could not create course.");
        return;
      }
      setTitle("");
      setDescription("");
      setMessage("Course created as draft.");
      router.refresh();
    } catch {
      setMessage("The course service could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(courseId: string, status: CourseStatus) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(result?.message ?? "Could not update course status.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function beginEditCourse(course: CourseRecord) {
    setEditingCourseId(course.id);
    setEditTitle(course.title);
    setEditDescription(course.description ?? "");
    setMessage(null);
  }

  async function saveCourse(courseId: string) {
    if (!editTitle.trim()) {
      setMessage("Course title is required.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() || null }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setMessage(result?.message ?? "Could not edit course.");
        return;
      }
      setEditingCourseId(null);
      setMessage("Course updated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourse(course: CourseRecord) {
    if (!window.confirm(`Delete “${course.title}”? Courses with student history are protected and will not be deleted.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/courses/${course.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setMessage(result?.message ?? "Could not delete course.");
        return;
      }
      setMessage("Course deleted.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-lg border bg-muted/40 p-4 text-sm">{message}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create course</CardTitle>
          <CardDescription>Build the course structure here. Enrollment and payment remain separate from course creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createCourse} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="course-title">Course title</Label><Input id="course-title" value={title} onChange={(event) => setTitle(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="course-description">Description</Label><Textarea id="course-description" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" /></div>
            <Button type="submit" disabled={busy}>{busy ? "Working..." : "Create draft course"}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {initialCourses.map((course) => (
          <Card key={course.id}>
            <CardContent className="py-5">
              {editingCourseId === course.id ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`edit-course-title-${course.id}`}>Course title</Label>
                    <Input id={`edit-course-title-${course.id}`} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`edit-course-description-${course.id}`}>Description</Label>
                    <Textarea id={`edit-course-description-${course.id}`} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} className="min-h-24" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => void saveCourse(course.id)}>Save changes</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingCourseId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{course.title}</p><Badge variant="outline">{course.status}</Badge></div>
                    <p className="mt-1 text-sm text-muted-foreground">{course.description || "No course description yet."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild><Link href={`/admin/courses/${course.id}`}>Build course</Link></Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => beginEditCourse(course)}>Edit course</Button>
                    {course.status !== "PUBLISHED" ? (
                      <Button size="sm" disabled={busy} onClick={() => void setStatus(course.id, "PUBLISHED")}>Publish</Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => void setStatus(course.id, "DRAFT")}>Return to draft</Button>
                    )}
                    <Button variant="destructive" size="sm" disabled={busy} onClick={() => void deleteCourse(course)}>Delete course</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!initialCourses.length ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No courses created yet.</CardContent></Card> : null}
      </div>
    </div>
  );
}
