import { NextResponse } from "next/server";

import { hashSessionToken } from "@/features/access/domain/session";
import { PostgresAccessRepository } from "@/features/access/repositories/postgres-access.repository";
import {
  getStudentSessionCookieOptions,
  STUDENT_SESSION_COOKIE,
} from "@/features/access/server/session-cookie";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STUDENT_SESSION_COOKIE}=`))
    ?.slice(STUDENT_SESSION_COOKIE.length + 1);

  if (sessionToken) {
    const repository = new PostgresAccessRepository();
    await repository.revokeSession(hashSessionToken(sessionToken).hash);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    STUDENT_SESSION_COOKIE,
    "",
    getStudentSessionCookieOptions(new Date(0)),
  );
  return response;
}
