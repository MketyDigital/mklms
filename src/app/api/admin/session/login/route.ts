import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ADMIN_SESSION_COOKIE,
  createBuiltInAdminSession,
  getAdminCookieOptions,
  verifyAdminAccessKey,
} from "@/features/admin/server/admin-auth";
import {
  FixedWindowRateLimiter,
  getRequestClientKey,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const schema = z.object({ key: z.string().min(1).max(512) });
const limiter = new FixedWindowRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  const limit = limiter.consume(getRequestClientKey(request, "admin-login"));
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !verifyAdminAccessKey(parsed.data.key)) {
    return NextResponse.json(
      { ok: false, message: "Admin access could not be verified." },
      { status: 401 },
    );
  }

  const session = createBuiltInAdminSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    session.value,
    getAdminCookieOptions(session.expiresAt),
  );
  return response;
}
