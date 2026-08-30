import { NextResponse } from "next/server";
import { z } from "zod";

import { CLAIM_VERIFICATION_STRATEGIES } from "@/features/access/domain/claim-verification";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { getRuntimeAccessSettings } from "@/features/access/server/runtime";
import { AdminAccessService } from "@/features/access/services/admin-access.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";

const bulkAuthorizeSchema = z.object({
  action: z.literal("bulk-authorize"),
  mode: z.enum(["csv", "paste"]),
  input: z.string().min(1),
  courseId: z.string().trim().optional().nullable(),
  claimStrategy: z.enum(CLAIM_VERIFICATION_STRATEGIES),
  source: z.string().trim().min(1).max(80).default("admin"),
});

const resetCodeSchema = z.object({
  action: z.literal("reset-code"),
  studentId: z.string().min(1),
});

const setStatusSchema = z.object({
  action: z.literal("set-student-status"),
  studentId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
});

const actionSchema = z.discriminatedUnion("action", [
  bulkAuthorizeSchema,
  resetCodeSchema,
  setStatusSchema,
]);

async function requireAdmin() {
  return hasValidAdminSession();
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const repository = new PostgresAdminAccessRepository();
  const [preauthorizations, students] = await Promise.all([
    repository.listPreauthorizations(250),
    repository.listStudents(250),
  ]);

  return NextResponse.json({ ok: true, preauthorizations, students });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "The admin request was not valid." },
      { status: 400 },
    );
  }

  const repository = new PostgresAdminAccessRepository();
  const settings = await getRuntimeAccessSettings();
  const service = new AdminAccessService(repository, {
    accessCodePrefix: settings.accessCodePrefix,
  });

  if (parsed.data.action === "bulk-authorize") {
    const result = await service.bulkAuthorize({
      mode: parsed.data.mode,
      input: parsed.data.input,
      courseId: parsed.data.courseId || null,
      claimStrategy: parsed.data.claimStrategy,
      source: parsed.data.source,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (parsed.data.action === "reset-code") {
    const result = await service.resetAccessCode(parsed.data.studentId);
    return NextResponse.json({
      ok: true,
      accessCode: result.accessCode,
      message: "A new student access code was issued. The previous code is no longer valid.",
    });
  }

  await service.setStudentStatus(parsed.data.studentId, parsed.data.status);
  return NextResponse.json({ ok: true, status: parsed.data.status });
}
