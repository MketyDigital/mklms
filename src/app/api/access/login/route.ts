import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresAccessRepository } from "@/features/access/repositories/postgres-access.repository";
import { AccessLoginService } from "@/features/access/services/access-login.service";
import {
  getStudentSessionCookieOptions,
  STUDENT_SESSION_COOKIE,
} from "@/features/access/server/session-cookie";

const loginSchema = z.object({
  accessCode: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "We could not sign you in with that access code." },
      { status: 400 },
    );
  }

  const repository = new PostgresAccessRepository();
  const service = new AccessLoginService(repository, {
    sessionTtlSeconds: Number(process.env.STUDENT_SESSION_TTL_SECONDS ?? 604800),
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
