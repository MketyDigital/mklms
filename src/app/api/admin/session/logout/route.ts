import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  getAdminCookieOptions,
} from "@/features/admin/server/admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    "",
    getAdminCookieOptions(new Date(0)),
  );
  return response;
}
