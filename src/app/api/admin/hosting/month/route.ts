import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import { isValidManagedHostingOperatorKey } from "@/features/hosting/server/hosting-operator-auth";

const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const updateSchema = z.object({
  monthKey: z.string().regex(monthKeyPattern),
  minimumFloorUsd: z.number().min(0).max(100000),
  operatorNote: z.string().max(2000).nullable().optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "WAIVED"]).optional(),
  operatorKey: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid monthly billing details." }, { status: 400 });
  }

  if (!isValidManagedHostingOperatorKey(parsed.data.operatorKey)) {
    return NextResponse.json({ ok: false, message: "Invalid managed-hosting operator key." }, { status: 403 });
  }

  const month = await new PostgresManagedHostingRepository().upsertMonthOverride({
    monthKey: parsed.data.monthKey,
    minimumFloorUsd: parsed.data.minimumFloorUsd,
    operatorNote: parsed.data.operatorNote,
    paymentStatus: parsed.data.paymentStatus,
  });

  return NextResponse.json({ ok: true, month });
}
