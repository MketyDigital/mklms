import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import { isValidManagedHostingOperatorKey } from "@/features/hosting/server/hosting-operator-auth";
import { getBillingMonthKey } from "@/features/hosting/domain/managed-hosting";

const schema = z.object({
  monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  minimumFloorUsd: z.number().min(0).max(100000),
  operatorNote: z.string().max(2000).nullable().optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "WAIVED"]),
});

function operatorKey(request: Request): string | null {
  return request.headers.get("x-mklms-operator-key");
}

export async function GET(request: Request) {
  if (!isValidManagedHostingOperatorKey(operatorKey(request))) {
    return NextResponse.json({ ok: false, message: "Invalid operator key." }, { status: 403 });
  }
  const monthKey = new URL(request.url).searchParams.get("monthKey") || getBillingMonthKey();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    return NextResponse.json({ ok: false, message: "Invalid month." }, { status: 400 });
  }
  const month = await new PostgresManagedHostingRepository().getMonthOverride(monthKey);
  return NextResponse.json({ ok: true, monthKey, month });
}

export async function POST(request: Request) {
  if (!isValidManagedHostingOperatorKey(operatorKey(request))) {
    return NextResponse.json({ ok: false, message: "Invalid operator key." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid monthly billing details." }, { status: 400 });
  }
  const month = await new PostgresManagedHostingRepository().upsertMonthOverride(parsed.data);
  return NextResponse.json({ ok: true, month });
}
