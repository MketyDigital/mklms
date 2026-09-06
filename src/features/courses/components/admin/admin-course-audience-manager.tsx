"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CourseAssignmentMode } from "@/features/courses/repositories/postgres-course-audience.repository";

type StudentOption = {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
};

export function AdminCourseAudienceManager({
  courseId,
  initialMode,
  students,
  initiallyEnrolledStudentIds,
}: {
  courseId: string;
  initialMode: CourseAssignmentMode;
  students: StudentOption[];
  initiallyEnrolledStudentIds: string[];
}) {
  const [mode, setMode] = useState<CourseAssignmentMode>(initialMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initiallyEnrolledStudentIds),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const allSelected = useMemo(
    () => students.length > 0 && students.every((student) => selectedIds.has(student.id)),
    [students, selectedIds],
  );

  function toggleStudent(studentId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(() =>
      allSelected ? new Set<string>() : new Set(students.map((student) => student.id)),
    );
  }

  async function saveAudience() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/audience`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          studentIds: mode === "SELECTED_STUDENTS" ? Array.from(selectedIds) : [],
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; audience?: { enrolledStudentIds?: string[] } }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Course audience could not be saved.");
      }
      if (payload.audience?.enrolledStudentIds) {
        setSelectedIds(new Set(payload.audience.enrolledStudentIds));
      }
      setMessage("Course audience saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Course audience could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course audience</CardTitle>
        <CardDescription>
          Choose who receives this paid course. Course access still requires an active student account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <input
            type="radio"
            name={`course-audience-${courseId}`}
            value="ALL_ACTIVE_STUDENTS"
            checked={mode === "ALL_ACTIVE_STUDENTS"}
            onChange={() => setMode("ALL_ACTIVE_STUDENTS")}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">All active students</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Enroll every active student now and automatically enroll future students when their account becomes active.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <input
            type="radio"
            name={`course-audience-${courseId}`}
            value="SELECTED_STUDENTS"
            checked={mode === "SELECTED_STUDENTS"}
            onChange={() => setMode("SELECTED_STUDENTS")}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Selected students</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Only the active students you select below receive this course. Completed student history is preserved.
            </span>
          </span>
        </label>

        {mode === "SELECTED_STUDENTS" ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Active students</p>
                <p className="text-xs text-muted-foreground">
                  {selectedIds.size} selected of {students.length} active students.
                </p>
              </div>
              {students.length ? (
                <Button type="button" size="sm" variant="outline" onClick={toggleAll}>
                  {allSelected ? "Clear all" : "Select all"}
                </Button>
              ) : null}
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {students.map((student) => (
                <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(student.id)}
                    onChange={() => toggleStudent(student.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{student.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {student.email || student.phone || student.id}
                    </span>
                  </span>
                </label>
              ))}
              {!students.length ? (
                <p className="py-4 text-sm text-muted-foreground">No active students are available yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={saveAudience} disabled={busy}>
            {busy ? "Saving…" : "Save course audience"}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
