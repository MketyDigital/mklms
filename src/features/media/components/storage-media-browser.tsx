"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type StorageMediaObject = {
  assetId: string;
  title: string;
  sourceType: "DIRECT" | "HLS";
  size: number | null;
  uploadedAt: string | null;
  registered: boolean;
};

type StorageMediaPage = {
  objects: StorageMediaObject[];
  cursor: string | null;
  truncated: boolean;
};

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "Size unavailable";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchStorageMediaPage(nextCursor?: string): Promise<StorageMediaPage> {
  const query = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : "";
  const response = await fetch(`/api/admin/media/storage${query}`, { cache: "no-store" });
  const result = await response.json().catch(() => null) as {
    ok?: boolean;
    message?: string;
    objects?: StorageMediaObject[];
    cursor?: string | null;
    truncated?: boolean;
  } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message ?? "Private storage media could not be loaded.");
  }
  return {
    objects: result.objects ?? [],
    cursor: result.cursor ?? null,
    truncated: Boolean(result.truncated),
  };
}

export function StorageMediaBrowser() {
  const router = useRouter();
  const [objects, setObjects] = useState<StorageMediaObject[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchStorageMediaPage()
      .then((page) => {
        if (cancelled) return;
        setObjects(page.objects);
        setTitles(Object.fromEntries(page.objects.map((object) => [object.assetId, object.title])));
        setCursor(page.cursor);
        setTruncated(page.truncated);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Private storage media could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const page = await fetchStorageMediaPage(cursor);
      setObjects((current) => [...current, ...page.objects]);
      setTitles((current) => {
        const updated = { ...current };
        for (const object of page.objects) {
          if (!updated[object.assetId]) updated[object.assetId] = object.title;
        }
        return updated;
      });
      setCursor(page.cursor);
      setTruncated(page.truncated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Private storage media could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function register(object: StorageMediaObject) {
    setBusyAssetId(object.assetId);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/media/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: object.assetId,
          title: titles[object.assetId] || object.title,
        }),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !result?.ok) {
        setMessage(result?.message ?? "Media could not be registered.");
        return;
      }
      setObjects((current) => current.map((item) => (
        item.assetId === object.assetId ? { ...item, registered: true } : item
      )));
      setMessage("Media registered in the library. It is now available to courses and live classes.");
      router.refresh();
    } catch {
      setMessage("Media could not be registered.");
    } finally {
      setBusyAssetId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Existing private storage media</CardTitle>
        <CardDescription>
          MP4 and HLS playlist files already in the configured private bucket appear here. Register them once to use them in courses and live classes; the files are not moved or re-uploaded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <p className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p> : null}
        {objects.map((object) => (
          <div key={object.assetId} className="rounded-lg border p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <p className="break-all text-xs text-muted-foreground">{object.assetId}</p>
                <Input
                  aria-label={`Title for ${object.assetId}`}
                  value={titles[object.assetId] ?? object.title}
                  disabled={object.registered}
                  onChange={(event) => setTitles((current) => ({
                    ...current,
                    [object.assetId]: event.target.value,
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  {object.sourceType} · {formatBytes(object.size)}{object.uploadedAt ? ` · ${new Date(object.uploadedAt).toLocaleString()}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant={object.registered ? "secondary" : "default"}
                disabled={object.registered || busyAssetId === object.assetId}
                onClick={() => void register(object)}
              >
                {object.registered ? "Registered" : busyAssetId === object.assetId ? "Registering..." : "Register"}
              </Button>
            </div>
          </div>
        ))}
        {!loading && objects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No compatible MP4 or HLS playlist files were found in private storage.</p>
        ) : null}
        {loading ? <p className="text-sm text-muted-foreground">Loading private storage media...</p> : null}
        {truncated && cursor ? (
          <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loading}>
            Load more
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
