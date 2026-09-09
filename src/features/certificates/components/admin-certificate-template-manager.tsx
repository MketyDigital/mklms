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
import { CertificatePlacementEditor } from "./certificate-placement-editor";
import {
  DEFAULT_CERTIFICATE_VISUAL_LAYOUT,
  type CertificateVisualLayoutV2,
} from "../providers/certificate-layout";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [visualLayout, setVisualLayout] = useState<CertificateVisualLayoutV2>(
    DEFAULT_CERTIFICATE_VISUAL_LAYOUT,
  );

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    formData.set("visualLayout", JSON.stringify(visualLayout));
    try {
      const response = await fetch("/api/admin/certificate-templates", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Template upload failed.");
      }
      setMessage("Certificate template uploaded, positioned and activated.");
      setSelectedFile(null);
      setVisualLayout(DEFAULT_CERTIFICATE_VISUAL_LAYOUT);
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
            Upload the finished PDF, PNG or JPEG artwork, then drag the student name, completion date and certificate ID directly onto their intended blank areas. Placement is saved relative to the artwork so the same system works across installations and different certificate sizes.
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
              <span className="font-medium">Template artwork</span>
              <Input
                name="file"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                required
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              <span className="block text-xs text-muted-foreground">
                Accepted: PDF, PNG, JPEG. Remove placeholder words from the artwork itself before uploading.
              </span>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Certificate ID prefix</span>
              <Input name="certificatePrefix" placeholder="CERT" />
            </label>
            <div className="hidden md:block" />

            <div className="min-w-0 md:col-span-2">
              <CertificatePlacementEditor
                file={selectedFile}
                value={visualLayout}
                onChange={setVisualLayout}
              />
            </div>

            {message ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm md:col-span-2">
                {message}
              </div>
            ) : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={busy || !selectedFile} className="w-full sm:w-auto">
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
                <div key={template.id} className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.courseId
                        ? courses.find((course) => course.id === template.courseId)?.title ?? "Course-specific"
                        : "Global default"}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-2 py-1 text-xs ${template.active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
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
