import { NextResponse } from "next/server";

import { createPostgresAdminAccessRepository } from "@/features/access/repositories/access-repository.factory";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const repository = createPostgresAdminAccessRepository();
  return NextResponse.json({
    ok: true,
    students: await repository.listStudents(250),
  });
}
