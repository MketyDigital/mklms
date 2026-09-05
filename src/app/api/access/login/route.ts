import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresAccessRepository } from "@/features/access/repositories/postgres-access.repository";
import { AccessLoginService } from "@/features/access/services/access-login.service";
import { getStudentSessionCookieOptions, STUDENT_SESSION_COOKIE } from "@/features/access/server/session-cookie";
import {
  consumeDistributedRateLimit,
  FixedWindowRateLimiter,
  getRequestClientKey,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const loginSchema = z.object({ accessCode: z.string().min(1).max(128) });
const limiter = new FixedWindowRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  const clientKey = getRequestClientKey(request, "student-login");
  const localLimit = limiter.consume(clientKey);
  if (!localLimit.allowed) {
    return NextResponse.json({ ok: false, message: "Too many sign-in attempts. Try again later." }, { status: 429, headers: rateLimitHeaders(localLimit) });
  }

  const distributedLimit = await consumeDistributedRateLimit("AUTH_RATE_LIMITER", clientKey);
  if (!distributedLimit.allowed) {
    return NextResponse.json({ ok: false, message: "Too many sign-in attempts. Try again shortly." }, { status: 429, headers: rateLimitHeaders(distributedLimit) });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "We could not sign you in with that access code." }, { status: 400 });

  try {
    const service = new AccessLoginService(new PostgresAccessRepository(), {
      sessionTtlSeconds: Number(process.env.MKLMS_STUDENT_SESSION_TTL_SECONDS ?? 1209600),
    });
    const result = await service.login(parsed.data.accessCode);
    if (!result.ok) return NextResponse.json({ ok: false, message: result.publicMessage }, { status: 401 });

    const response = NextResponse.json({ ok: true, studentId: result.studentId });
    response.cookies.set(STUDENT_SESSION_COOKIE, result.sessionToken, getStudentSessionCookieOptions(result.expiresAt));
    return response;
  } catch (error) {
    console.error("MkLMS student login failed", error);
    return NextResponse.json({ ok: false, message: "The sign-in service could not reach the production database. Please retry." }, { status: 503 });
  }
}
