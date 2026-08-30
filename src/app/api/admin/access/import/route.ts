import { NextResponse } from "next/server";
import { z } from "zod";

import { generateAccessCode } from "@/features/access/domain/access-code";
import { CLAIM_VERIFICATION_STRATEGIES } from "@/features/access/domain/claim-verification";
import {
  parsePreauthorizationCsv,
  parsePreauthorizationPaste,
} from "@/features/access/domain/import-preauthorizations";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { AccessAdminService } from "@/features/access/services/access-admin.service";
import { hasValidAdminSession } from "@/features/admin/server/admin-auth";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

const schema = z.object({
  mode: z.enum(["csv", "paste"]),
  content: z.string().min(1).max(2_000_000),
  courseId: z.string().max(160).optional(),
  claimStrategy: z.enum(CLAIM_VERIFICATION_STRATEGIES),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid bulk authorization request." },
      { status: 400 },
    );
  }

  const imported =
    parsed.data.mode === "csv"
      ? parsePreauthorizationCsv(parsed.data.content)
      : parsePreauthorizationPaste(parsed.data.content);

  const settings = await new PostgresSettingsRepository().getPlatformSettings();
  const service = new AccessAdminService(new PostgresAdminAccessRepository(), {
    accessCodePrefix: settings.accessCodePrefix,
  });

  const created: Array<{
    id: string;
    email?: string | null;
    phone?: string | null;
    claimCode?: string;
  }> = [];
  const errors = [...imported.errors];

  for (let index = 0; index < imported.rows.length; index += 1) {
    const row = imported.rows[index];
    const claimCode =
      parsed.data.claimStrategy === "claim-code"
        ? generateAccessCode({ prefix: "CLAIM", randomBytes: 12 })
        : undefined;

    try {
      const result = await service.preauthorize({
        email: row.email,
        phone: row.phone,
        nameHint: row.name,
        courseId: row.courseId ?? parsed.data.courseId,
        claimStrategy: parsed.data.claimStrategy,
        claimCode,
        source: parsed.data.mode === "csv" ? "csv-import" : "bulk-paste",
      });
      created.push({
        id: result.id,
        email: result.email,
        phone: result.phone,
        ...(claimCode ? { claimCode } : {}),
      });
    } catch (error) {
      errors.push({
        line: index + 1,
        code: "INVALID_IDENTITY",
        message: error instanceof Error ? error.message : "Could not authorize this row.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    createdCount: created.length,
    created,
    errors,
  });
}
