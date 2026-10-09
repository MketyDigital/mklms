import { NextResponse } from "next/server";
import { getMediaDb } from "../../../src/lib/postgres";

function uuidFromShortId(shortId: string) {
  if (!/^[A-Za-z0-9_-]{22}$/.test(shortId)) return null;
  try {
    const base64 = shortId.replace(/-/g, "+").replace(/_/g, "/") + "==";
    const binary = atob(base64);
    if (binary.length !== 16) return null;
    const hex = Array.from(binary, char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    return hex.slice(0, 8)+"-"+hex.slice(8, 12)+"-"+hex.slice(12, 16)+"-"+hex.slice(16, 20)+"-"+hex.slice(20);
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const objectId = uuidFromShortId(id);
  if (!objectId) return new Response("Not Found", { status: 404 });

  const row = await getMediaDb().prepare(
    "SELECT o.object_key,b.slug AS bucket_slug,t.slug AS tenant_slug FROM media_objects o JOIN media_buckets b ON b.id=o.bucket_id JOIN media_tenants t ON t.id=b.tenant_id WHERE o.id=? AND o.status='ready' LIMIT 1"
  ).bind(objectId).first<any>();
  if (!row) return new Response("Not Found", { status: 404 });

  const key = String(row.object_key).split("/").map(encodeURIComponent).join("/");
  const target = "https://assets.mkety.app/"+encodeURIComponent(String(row.tenant_slug))+"/"+encodeURIComponent(String(row.bucket_slug))+"/"+key;
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
