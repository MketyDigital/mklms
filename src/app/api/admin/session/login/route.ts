import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ADMIN_SESSION_COOKIE,
  createBuiltInAdminSession,
  getAdminCookieOptions,
  verifyAdminAccessKey,
} from "@/features/admin/server/admin-auth";

const schema = z.object({ key: z.string().min(1).max(512) });

export async function POST(request: Request) {
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
