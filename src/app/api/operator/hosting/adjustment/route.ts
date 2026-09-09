import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresManagedHostingLedgerRepository } from "@/features/hosting/repositories/postgres-managed-hosting-ledger.repository";
import { isValidManagedHostingOperatorKey } from "@/features/hosting/server/hosting-operator-auth";

const schema = z.object({
  amountUsd: z.number().min(-100000).max(100000),
  reason: z.string().trim().min(3).max(1000),
});

function operatorKey(request: Request): string | null {
  return request.headers.get("x-mklms-operator-key");
}

export async function GET(request: Request) {
  if (!isValidManagedHostingOperatorKey(operatorKey(request))) {
    return NextResponse.json({ ok: false, message: "Operator controls are available only in Mkety production." }, { status: 403 });
  }
  const monthKey = new URL(request.url).searchParams.get("monthKey") ?? undefined;
  if (monthKey && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    return NextResponse.json({ ok: false, message: "Invalid month." }, { status: 400 });
  }
  const repository = new PostgresManagedHostingLedgerRepository();
  const [entries, totalAdjustmentUsd] = await Promise.all([
    repository.listMonth(monthKey),
    repository.getMonthAdjustmentTotal(monthKey),
  ]);
  return NextResponse.json({ ok: true, entries, totalAdjustmentUsd });
}

export async function POST(request: Request) {
  if (!isValidManagedHostingOperatorKey(operatorKey(request))) {
    return NextResponse.json({ ok: false, message: "Operator controls are available only in Mkety production." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Enter a valid adjustment and reason." }, { status: 400 });
  }
  const entry = await new PostgresManagedHostingLedgerRepository().setDailyOperatorAdjustment(parsed.data);
  return NextResponse.json({ ok: true, entry });
}
