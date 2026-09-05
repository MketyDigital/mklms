import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface CloudflareRateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export type DistributedRateLimitBindingName =
  | "AUTH_RATE_LIMITER"
  | "ADMIN_RATE_LIMITER"
  | "STUDENT_MUTATION_RATE_LIMITER"
  | "PLAYBACK_RATE_LIMITER"
  | "CERT_RATE_LIMITER";

export class FixedWindowRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: { limit: number; windowMs: number; maxEntries?: number }) {
    this.limit = Math.max(1, Math.floor(options.limit));
    this.windowMs = Math.max(1_000, Math.floor(options.windowMs));
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 10_000));
  }

  get size(): number {
    return this.buckets.size;
  }

  consume(key: string, now = new Date()): RateLimitResult {
    const timestamp = now.getTime();
    const normalizedKey = key.trim() || "unknown";
    const existing = this.buckets.get(normalizedKey);

    if (!existing || existing.resetAt <= timestamp) {
      this.ensureCapacity(timestamp);
      this.buckets.set(normalizedKey, {
        count: 1,
        resetAt: timestamp + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.limit - 1,
        retryAfterSeconds: Math.ceil(this.windowMs / 1000),
      };
    }

    if (existing.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - timestamp) / 1000)),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - existing.count),
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - timestamp) / 1000)),
    };
  }

  private ensureCapacity(now: number): void {
    if (this.buckets.size < this.maxEntries) return;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
      if (this.buckets.size < this.maxEntries) return;
    }

    const oldestKey = this.buckets.keys().next().value as string | undefined;
    if (oldestKey) this.buckets.delete(oldestKey);
  }
}

function failOpenResult(retryAfterSeconds: number): RateLimitResult {
  return { allowed: true, remaining: -1, retryAfterSeconds };
}

export async function consumeRateLimitBinding(
  binding: CloudflareRateLimitBinding | undefined,
  key: string,
  retryAfterSeconds: number,
  fallback?: FixedWindowRateLimiter,
  now = new Date(),
): Promise<RateLimitResult> {
  const normalizedKey = key.trim() || "unknown";
  if (!binding) {
    console.warn("MkLMS distributed rate limiter binding is missing; using safe fallback");
    return fallback?.consume(normalizedKey, now) ?? failOpenResult(retryAfterSeconds);
  }

  try {
    const result = await binding.limit({ key: normalizedKey });
    return result.success
      ? failOpenResult(retryAfterSeconds)
      : { allowed: false, remaining: 0, retryAfterSeconds };
  } catch (error) {
    console.warn("MkLMS distributed rate limiter unavailable; using safe fallback", error);
    return fallback?.consume(normalizedKey, now) ?? failOpenResult(retryAfterSeconds);
  }
}

export async function consumeDistributedRateLimit(
  bindingName: DistributedRateLimitBindingName,
  key: string,
  fallback?: FixedWindowRateLimiter,
): Promise<RateLimitResult> {
  try {
    const context = getCloudflareContext();
    const env = context.env as unknown as Partial<Record<DistributedRateLimitBindingName, CloudflareRateLimitBinding>>;
    return consumeRateLimitBinding(env[bindingName], key, 60, fallback);
  } catch (error) {
    console.warn(`MkLMS ${bindingName} binding unavailable; using safe fallback`, error);
    return fallback?.consume(key) ?? failOpenResult(60);
  }
}

export function getRequestClientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  return `${scope}:${forwarded}`;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}
