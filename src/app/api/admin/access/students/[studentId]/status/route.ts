import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";

const schema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid student status." },
      { status: 400 },
    );
  }

  const { studentId } = await context.params;
  const repository = new PostgresAdminAccessRepository();
  await repository.setStudentStatus(studentId, parsed.data.status);

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
