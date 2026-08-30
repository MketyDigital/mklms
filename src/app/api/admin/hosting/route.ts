import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { normalizeManagedHostingSettings } from "@/features/hosting/domain/managed-hosting";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";

const settingsSchema = z.object({
  enabled: z.boolean(),
  minimumMonthlyFeeUsd: z.number().min(0).max(10_000),
  maximumMonthlyFeeUsd: z.number().min(0).max(10_000),
  currentMonthlyFeeUsd: z.number().min(0).max(10_000),
  paymentNetwork: z.enum(["TRC20", "TON", "CUSTOM"]),
  walletAddress: z.string().trim().max(300),
  paymentNote: z.string().trim().max(1000).nullable().optional(),
});

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const repository = new PostgresManagedHostingRepository();
  const [settings, usage] = await Promise.all([
    repository.getSettings(),
    repository.getCurrentMonthUsage(),
  ]);
  return NextResponse.json({ ok: true, settings, usage });
}

export async function PUT(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid managed-hosting settings." }, { status: 400 });
  }
  if (parsed.data.maximumMonthlyFeeUsd < parsed.data.minimumMonthlyFeeUsd) {
    return NextResponse.json({ ok: false, message: "Maximum monthly fee cannot be below minimum monthly fee." }, { status: 400 });
  }
  const settings = normalizeManagedHostingSettings(parsed.data);
  await new PostgresManagedHostingRepository().updateSettings(settings);
  return NextResponse.json({ ok: true, settings });
}
