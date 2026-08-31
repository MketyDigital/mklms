import {
  normalizeObjectKey,
  verifyPlaybackAuthorization,
} from "./auth.ts";
import { parseByteRange } from "./range.ts";

interface R2HttpMetadataLike {
  contentType?: string;
}

interface R2ObjectLike {
  size: number;
  httpMetadata?: R2HttpMetadataLike;
}

interface R2BodyLike extends R2ObjectLike {
  body: ReadableStream<Uint8Array>;
}

interface MediaBucketLike {
  head(key: string): Promise<R2ObjectLike | null>;
  get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<R2BodyLike | null>;
}

export interface MediaDeliveryEnv {
  MEDIA_BUCKET: MediaBucketLike;
  MKLMS_MEDIA_SIGNING_SECRET: string;
  MKLMS_MEDIA_ALLOWED_ORIGINS?: string;
}

function baseHeaders(contentType?: string): Headers {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  });
  headers.set("Content-Type", contentType || "application/octet-stream");
  return headers;
}

function mediaContentType(key: string, contentType?: string): string {
  if (contentType) return contentType;
  return key.toLowerCase().endsWith(".mp4")
    ? "video/mp4"
    : "application/octet-stream";
}

function applyCors(request: Request, env: MediaDeliveryEnv, headers: Headers): void {
  const origin = request.headers.get("Origin");
  if (!origin || !env.MKLMS_MEDIA_ALLOWED_ORIGINS) return;

  const allowed = env.MKLMS_MEDIA_ALLOWED_ORIGINS
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.append("Vary", "Origin");
  }
}

function forbidden(): Response {
  return new Response("Playback authorization is invalid or expired.", {
    status: 403,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notFound(): Response {
  return new Response("Media is unavailable.", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function handleMediaRequest(
  request: Request,
  env: MediaDeliveryEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const url = new URL(request.url);
  const objectKey = normalizeObjectKey(url.pathname);
  const assetId = url.searchParams.get("mk_asset")?.trim() ?? "";
  const viewer = url.searchParams.get("mk_viewer")?.trim() ?? "";
  const signature = url.searchParams.get("mk_sig")?.trim() ?? "";
  const expiryRaw = url.searchParams.get("mk_exp")?.trim() ?? "";
  const expiresEpoch = /^\d+$/.test(expiryRaw) ? Number(expiryRaw) : Number.NaN;

  if (!objectKey) return forbidden();

  const auth = await verifyPlaybackAuthorization(
    {
      assetId,
      objectKey,
      viewer,
      expiresEpoch,
      signature,
    },
    env.MKLMS_MEDIA_SIGNING_SECRET,
  );
  if (!auth.ok) return forbidden();

  const metadata = await env.MEDIA_BUCKET.head(objectKey);
  if (!metadata) return notFound();

  const contentType = mediaContentType(objectKey, metadata.httpMetadata?.contentType);
  const range = parseByteRange(request.headers.get("Range"), metadata.size);

  if (range && !range.ok) {
    const headers = baseHeaders(contentType);
    headers.set("Content-Range", `bytes */${metadata.size}`);
    applyCors(request, env, headers);
    return new Response(null, { status: 416, headers });
  }

  const headers = baseHeaders(contentType);
  applyCors(request, env, headers);

  if (range?.ok) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${metadata.size}`);
    headers.set("Content-Length", String(range.length));

    if (request.method === "HEAD") {
      return new Response(null, { status: 206, headers });
    }

    const object = await env.MEDIA_BUCKET.get(objectKey, {
      range: { offset: range.start, length: range.length },
    });
    if (!object) return notFound();
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(metadata.size));
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  const object = await env.MEDIA_BUCKET.get(objectKey);
  if (!object) return notFound();
  return new Response(object.body, { status: 200, headers });
}

const worker = {
  fetch(request: Request, env: MediaDeliveryEnv): Promise<Response> {
    return handleMediaRequest(request, env);
  },
};

export { handleMediaRequest };
export default worker;
