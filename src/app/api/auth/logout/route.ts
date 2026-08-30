import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { hashSessionToken } from "@/features/access/domain/session";
import { getAccessRuntime } from "@/features/access/server/runtime";
import { STUDENT_SESSION_COOKIE } from "@/features/access/server/session-cookie";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;

  if (token) {
    const { repository } = await getAccessRuntime();
    await repository.revokeSession(hashSessionToken(token).hash);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STUDENT_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
