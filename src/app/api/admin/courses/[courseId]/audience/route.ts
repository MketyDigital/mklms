import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresCourseAudienceRepository } from "@/features/courses/repositories/postgres-course-audience.repository";
import {
  consumeDistributedRateLimit,
  getRequestClientKey,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const schema = z.object({
  mode: z.enum(["SELECTED_STUDENTS", "ALL_ACTIVE_STUDENTS"]),
  studentIds: z.array(z.string().min(1)).default([]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const limit = await consumeDistributedRateLimit(
    "ADMIN_RATE_LIMITER",
    getRequestClientKey(request, "admin-course-audience"),
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many course audience updates. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid course audience selection." },
      { status: 400 },
    );
  }

  try {
    const { courseId } = await context.params;
    const audience = await new PostgresCourseAudienceRepository().setCourseAudience(
      courseId,
      parsed.data.mode,
      parsed.data.mode === "SELECTED_STUDENTS" ? parsed.data.studentIds : [],
    );

    return NextResponse.json({ ok: true, audience });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not found/i.test(message)) {
      return NextResponse.json({ ok: false, message: "Course not found." }, { status: 404 });
    }
    if (/not active/i.test(message)) {
      return NextResponse.json(
        { ok: false, message: "One or more selected students are no longer active. Refresh and try again." },
        { status: 400 },
      );
    }

    console.error("MkLMS course audience update failed", error);
    return NextResponse.json(
      { ok: false, message: "Course audience could not be updated right now." },
      { status: 500 },
    );
  }
}
