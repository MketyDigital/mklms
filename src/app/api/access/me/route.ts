import { NextResponse } from "next/server";

import { hashSessionToken } from "@/features/access/domain/session";
import { PostgresAccessRepository } from "@/features/access/repositories/postgres-access.repository";
import { STUDENT_SESSION_COOKIE } from "@/features/access/server/session-cookie";

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value || null;
}

export async function GET(request: Request) {
  const sessionToken = readCookie(request, STUDENT_SESSION_COOKIE);
  if (!sessionToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const repository = new PostgresAccessRepository();
  const session = await repository.findActiveSessionByTokenHash(
    hashSessionToken(sessionToken).hash,
    new Date(),
  );

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    student: {
      id: session.studentId,
      name: session.displayName,
      email: session.email ?? null,
    },
    expiresAt: session.expiresAt.toISOString(),
  });
}
