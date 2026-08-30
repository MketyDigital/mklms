import { NextResponse } from "next/server";

import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const repository = new PostgresAdminAccessRepository();
  return NextResponse.json({
    ok: true,
    students: await repository.listStudents(250),
  });
}
