"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CourseOption {
  id: string;
  title: string;
}

interface TemplateItem {
  id: string;
  name: string;
  courseId?: string | null;
  backgroundAssetId?: string | null;
  active: boolean;
}

export function AdminCertificateTemplateManager({
  courses,
  templates,
}: {
  courses: CourseOption[];
  templates: TemplateItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/certificate-templates", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Template upload failed.");
      }
      setMessage("Certificate template uploaded and activated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload certificate template</CardTitle>
          <CardDescription>
            Use an existing signed PDF, PNG, or JPEG. Coordinates are PDF points measured from the bottom-left; leave them blank to use sensible defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submit} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Template name</span>
              <Input name="name" required placeholder="Default course certificate" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Course scope</span>
              <select
                name="courseId"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">All courses (default)</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Template file</span>
              <Input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Certificate ID prefix</span>
              <Input name="certificatePrefix" placeholder="CERT" />
            </label>
            <div className="hidden md:block" />

            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium">Optional placement</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input name="nameX" type="number" step="0.1" placeholder="Name X" />
                <Input name="nameY" type="number" step="0.1" placeholder="Name Y" />
                <Input name="nameFontSize" type="number" step="0.1" placeholder="Name size" />
                <Input name="dateX" type="number" step="0.1" placeholder="Date X" />
                <Input name="dateY" type="number" step="0.1" placeholder="Date Y" />
                <Input name="dateFontSize" type="number" step="0.1" placeholder="Date size" />
                <Input name="idX" type="number" step="0.1" placeholder="ID X" />
                <Input name="idY" type="number" step="0.1" placeholder="ID Y" />
                <Input name="idFontSize" type="number" step="0.1" placeholder="ID size" />
              </div>
            </div>

            {message ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm md:col-span-2">
                {message}
              </div>
            ) : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <FileUp className="mr-1.5 size-4" />}
                Upload and activate
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured templates</CardTitle>
          <CardDescription>
            Course-specific templates override the active global default for that course.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No certificate templates configured yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.courseId
                        ? courses.find((course) => course.id === template.courseId)?.title ?? "Course-specific"
                        : "Global default"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${template.active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {template.active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
