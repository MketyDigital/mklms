import { NextResponse } from "next/server";
import { z } from "zod";

import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import { isValidManagedHostingOperatorKey } from "@/features/hosting/server/hosting-operator-auth";
import { getEffectiveManagedHostingPolicy } from "@/features/hosting/server/managed-hosting-policy";

const schema = z.object({
  enabled: z.boolean(),
  minimumMonthlyFeeUsd: z.number().min(0).max(100000),
  maximumMonthlyFeeUsd: z.number().min(0).max(100000),
  displayTitle: z.string().trim().min(1).max(200),
  displayDescription: z.string().max(2000).nullable().optional(),
  notice: z.string().max(2000).nullable().optional(),
  overdueWarning: z.string().max(2000).nullable().optional(),
  dueDaysAfterMonthEnd: z.number().int().min(0).max(31),
  graceDays: z.number().int().min(0).max(31),
  enforcementEnabled: z.boolean(),
});

function operatorKey(request: Request): string | null {
  return request.headers.get("x-mklms-operator-key");
}

export async function GET(request: Request) {
  if (!isValidManagedHostingOperatorKey(operatorKey(request))) {
    return NextResponse.json({ ok: false, message: "Invalid operator key." }, { status: 403 });
  }

  const repository = new PostgresManagedHostingRepository();
  const [stored, effective] = await Promise.all([
    repository.getOperatorPolicy(),
    getEffectiveManagedHostingPolicy(repository),
  ]);

  return NextResponse.json({
    ok: true,
    policy: stored?.configured ? stored : {
      configured: false,
      enabled: effective.policy.enabled,
      minimumMonthlyFeeUsd: effective.policy.minimumMonthlyFeeUsd,
      maximumMonthlyFeeUsd: effective.policy.maximumMonthlyFeeUsd,
      displayTitle: effective.displayTitle,
      displayDescription: effective.displayDescription,
      notice: effective.policy.notice ?? null,
      overdueWarning: effective.overdueWarning,
      dueDaysAfterMonthEnd: effective.dueDaysAfterMonthEnd,
      graceDays: effective.graceDays,
      enforcementEnabled: effective.enforcementEnabled,
    },
  });
}

export async function POST(request: Request) {
  if (!isValidManagedHostingOperatorKey(operatorKey(request))) {
    return NextResponse.json({ ok: false, message: "Invalid operator key." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.maximumMonthlyFeeUsd < parsed.data.minimumMonthlyFeeUsd) {
    return NextResponse.json({ ok: false, message: "Invalid hosting policy." }, { status: 400 });
  }

  const policy = await new PostgresManagedHostingRepository().upsertOperatorPolicy(parsed.data);
  return NextResponse.json({ ok: true, policy });
}
