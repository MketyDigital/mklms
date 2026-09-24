/**
 * assets.mkety.app delivery Worker.
 *
 * URL contract:
 *   /{tenantSlug}/{bucketSlug}/{objectKey...}
 *
 * Production implementation should resolve tenant+bucket to provider metadata
 * from a small edge cache/KV and fetch the provider origin. The response is
 * cached with Cloudflare Cache API so origin storage is not hit on every view.
 *
 * This first worker intentionally fails closed until BUCKET_DIRECTORY is bound.
 */
export interface Env {
  BUCKET_DIRECTORY: KVNamespace;
}

type BucketRoute = {
  provider: "r2" | "oci" | "aws" | "gcs" | "azure";
  publicBaseUrl: string;
  cacheControl?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3) return new Response("Not Found", { status: 404 });

    const [tenantSlug, bucketSlug, ...keyParts] = parts;
    const objectKey = keyParts.join("/");
    const routeKey = `${tenantSlug}/${bucketSlug}`;

    const route = await env.BUCKET_DIRECTORY.get<BucketRoute>(routeKey, "json");
    if (!route?.publicBaseUrl) return new Response("Not Found", { status: 404 });

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    if (request.method === "GET") {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    const origin = new URL(route.publicBaseUrl);
    origin.pathname = `${origin.pathname.replace(/\/$/, "")}/${objectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    const upstream = await fetch(origin.toString(), {
      method: request.method,
      headers: {
        Range: request.headers.get("Range") ?? "",
      },
    });

    if (!upstream.ok) return new Response("Not Found", { status: upstream.status });

    const response = new Response(upstream.body, upstream);
    response.headers.set(
      "Cache-Control",
      route.cacheControl ?? "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400",
    );
    response.headers.set("X-Content-Type-Options", "nosniff");

    if (request.method === "GET" && upstream.status === 200) {
      await cache.put(cacheKey, response.clone());
    }

    return response;
  },
};
