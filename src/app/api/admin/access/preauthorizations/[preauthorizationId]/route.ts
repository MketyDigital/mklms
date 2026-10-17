import { NextResponse } from "next/server";
import { z } from "zod";

import { ACTIVE_CLAIM_VERIFICATION_STRATEGIES } from "@/features/access/domain/claim-verification";
import { hashClaimCode } from "@/features/access/domain/claim-code";
import { createPostgresAdminAccessRepository } from "@/features/access/repositories/access-repository.factory";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { createPostgresAdminLearningRepository } from "@/features/courses/repositories/learning-repository.factory";

const updateSchema = z.object({
  nameHint: z.string().max(160).nullable().optional(),
  courseId: z.string().max(160).nullable().optional(),
  claimStrategy: z.enum(ACTIVE_CLAIM_VERIFICATION_STRATEGIES),
  claimCode: z.string().min(1).max(160).nullable().optional(),
}).superRefine((value, context) => {
  if (value.claimStrategy === "claim-code" && !value.claimCode?.trim()) {
    context.addIssue({ code: "custom", message: "A new claim code is required for claim-code verification." });
  }
});

async function validateCourse(courseId?: string | null): Promise<void> {
  if (!courseId) return;
  const courses = await createPostgresAdminLearningRepository().listCourses();
  if (!courses.some((course) => course.id === courseId)) {
    throw new Error("The selected course no longer exists.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ preauthorizationId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid authorization update." }, { status: 400 });
  }
  try {
    await validateCourse(parsed.data.courseId);
    const { preauthorizationId } = await params;
    await createPostgresAdminAccessRepository().updatePendingPreauthorization(preauthorizationId, {
      nameHint: parsed.data.nameHint ?? null,
      courseId: parsed.data.courseId ?? null,
      claimStrategy: parsed.data.claimStrategy,
      claimCodeHash: parsed.data.claimStrategy === "claim-code" && parsed.data.claimCode
        ? hashClaimCode(parsed.data.claimCode)
        : null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Authorization could not be updated." }, { status: 409 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ preauthorizationId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { preauthorizationId } = await params;
    await createPostgresAdminAccessRepository().cancelPendingPreauthorization(preauthorizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Authorization could not be cancelled." }, { status: 409 });
  }
}
