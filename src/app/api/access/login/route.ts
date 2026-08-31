import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresAccessRepository } from "@/features/access/repositories/postgres-access.repository";
import { AccessLoginService } from "@/features/access/services/access-login.service";
import {
  getStudentSessionCookieOptions,
  STUDENT_SESSION_COOKIE,
} from "@/features/access/server/session-cookie";
import {
  FixedWindowRateLimiter,
  getRequestClientKey,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const loginSchema = z.object({
  accessCode: z.string().min(1).max(128),
});
const limiter = new FixedWindowRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  const limit = limiter.consume(getRequestClientKey(request, "student-login"));
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many sign-in attempts. Try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "We could not sign you in with that access code." },
      { status: 400 },
    );
  }

  const repository = new PostgresAccessRepository();
  const service = new AccessLoginService(repository, {
    sessionTtlSeconds: Number(
      process.env.MKLMS_STUDENT_SESSION_TTL_SECONDS ?? 1209600,
    ),
  });
  const result = await service.login(parsed.data.accessCode);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.publicMessage },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    studentId: result.studentId,
  });
  response.cookies.set(
    STUDENT_SESSION_COOKIE,
    result.sessionToken,
    getStudentSessionCookieOptions(result.expiresAt),
  );

  return response;
}
