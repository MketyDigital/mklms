import "server-only";

import { PostgresAccessRepository } from "../repositories/postgres-access.repository";
import { AccessLoginService } from "../services/access-login.service";
import { AccessService } from "../services/access.service";
import { getPostgresPool } from "@/lib/postgres";

export interface RuntimeAccessSettings {
  accessCodePrefix: string;
  claimVerificationStrategy: string;
  sessionTtlSeconds: number;
}

export async function getRuntimeAccessSettings(): Promise<RuntimeAccessSettings> {
  const pool = getPostgresPool();
  const result = await pool.query<{
    access_code_prefix: string;
    claim_verification_strategy: string;
  }>(
    `SELECT access_code_prefix, claim_verification_strategy
     FROM platform_settings
     ORDER BY created_at ASC
     LIMIT 1`,
  );

  const row = result.rows[0];
  return {
    accessCodePrefix:
      row?.access_code_prefix || process.env.MKLMS_ACCESS_CODE_PREFIX || "ACCESS",
    claimVerificationStrategy:
      row?.claim_verification_strategy ||
      process.env.MKLMS_CLAIM_VERIFICATION_STRATEGY ||
      "preauth-only",
    sessionTtlSeconds: Number(
      process.env.MKLMS_STUDENT_SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 14,
    ),
  };
}

export async function getAccessRuntime() {
  const repository = new PostgresAccessRepository(getPostgresPool());
  const settings = await getRuntimeAccessSettings();

  return {
    repository,
    settings,
    accessService: new AccessService(repository, {
      accessCodePrefix: settings.accessCodePrefix,
    }),
    loginService: new AccessLoginService(repository, {
      sessionTtlSeconds: settings.sessionTtlSeconds,
    }),
  };
}
