"use client";

import { useState } from "react";
import { Calculator, CheckCircle2, CircleAlert, CloudUpload, Copy, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface MediaIngestJobItem {
  id: string;
  title: string;
  state: string;
  durationMinutes: number | null;
  estimatedCostUsd: number | null;
  costAcceptedAt: string | null;
  sourceObjectKey: string | null;
  ociJobId: string | null;
  ociOutputPrefix: string | null;
  r2Prefix: string | null;
  r2MasterManifest: string | null;
}

export function MediaIngestPanel({
  initialJobs,
  automation,
}: {
  initialJobs: MediaIngestJobItem[];
  automation: { enabled: boolean; ready: boolean; missing: string[] };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createEstimate(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/media/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          durationMinutes: Number(formData.get("durationMinutes")),
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; estimate?: { usd: number } };
      if (!response.ok || !payload.ok) throw new Error(payload.message ?? "Could not create estimate.");
      setMessage(`Estimate created: about $${payload.estimate?.usd.toFixed(3)} for the conservative 3-rung Standard H264 profile.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create estimate.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptCost(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/media/ingest/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACCEPT_COST" }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message ?? "Could not accept estimate.");
      setMessage("Estimate accepted. You may now run the one-time Media Flow job manually, or use automation after it has been enabled and smoke-tested.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not accept estimate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" /> OCI Media Flow → R2 publishing</CardTitle>
          <CardDescription>
            Paid transcoding is a one-time ingest step. Finished HLS lives on R2/CDN; viewers do not repeatedly invoke OCI Media Flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            {automation.ready ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" /> : <CircleAlert className="mt-0.5 size-5 text-amber-600" />}
            <div>
              <p className="font-medium">Automation: {automation.ready ? "configured" : automation.enabled ? "incomplete" : "OFF by default"}</p>
              <p className="mt-1 text-muted-foreground">For the first production videos, use the manual-safe path below. Enable automation only after a tiny sample completes OCI → R2 → MkLMS successfully.</p>
              {automation.missing.length ? <p className="mt-2 break-all font-mono text-xs text-muted-foreground">Missing/disabled: {automation.missing.join(", ")}</p> : null}
            </div>
          </div>

          <form action={createEstimate} className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
            <label className="space-y-1.5 text-sm"><span className="font-medium">Video title</span><Input name="title" required placeholder="Free Class Day 1" /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Duration (minutes)</span><Input name="durationMinutes" type="number" min="1" step="0.1" required placeholder="60" /></label>
            <Button type="submit" disabled={busy}><Calculator className="mr-1.5 size-4" /> Estimate first</Button>
          </form>
          {message ? <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">{message}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual-safe path for the first videos</CardTitle>
          <CardDescription>This reaches exactly the same final R2 playback layout as the future automation and avoids making tomorrow&apos;s class depend on untested paid orchestration.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li><strong>1. Upload source to private OCI Object Storage.</strong> Use OCI Console, CLI, or a short-lived PAR. Do not upload the source through the Cloudflare Worker.</li>
            <li><strong>2. Run one Media Flow job.</strong> Standard H264, HLS, chosen ABR rungs. Use the source object and a unique output prefix.</li>
            <li><strong>3. Wait for Succeeded.</strong> Verify the output folder contains the HLS master playlist, variant playlists and segments before copying anything.</li>
            <li><strong>4. Copy the completed output prefix to R2.</strong> Use rclone or S3-compatible tooling. OCI public egress includes a large free monthly allowance, while R2 ingress is not billed as egress.</li>
            <li><strong>5. Verify R2 before deleting OCI files.</strong> Confirm master playlist and referenced segments exist in R2 and play correctly.</li>
            <li><strong>6. Register the R2 master path in Media Library.</strong> Example: <code>live/free-class-2026/day-1/master.m3u8</code>. Then attach that media asset to the live session.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CloudUpload className="size-4" /> Ingest estimates/jobs</CardTitle></CardHeader>
        <CardContent>
          {initialJobs.length ? <div className="divide-y rounded-lg border">{initialJobs.map((job) => (
            <div key={job.id} className="grid gap-3 p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
              <div><p className="font-medium">{job.title}</p><p className="mt-1 text-xs text-muted-foreground">{job.durationMinutes ?? "?"} min · estimate ${job.estimatedCostUsd?.toFixed(3) ?? "—"} · {job.state}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{job.r2MasterManifest ?? job.ociOutputPrefix ?? job.sourceObjectKey ?? job.id}</p></div>
              <div>{job.costAcceptedAt ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700">Cost accepted</span> : <Button size="sm" variant="outline" disabled={busy} onClick={() => void acceptCost(job.id)}><Copy className="mr-1.5 size-3.5" /> Accept estimate</Button>}</div>
            </div>
          ))}</div> : <p className="text-sm text-muted-foreground">No ingest estimates yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
