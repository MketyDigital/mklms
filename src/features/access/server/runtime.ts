import "server-only";

import {
  CLAIM_VERIFICATION_STRATEGIES,
  type ClaimVerificationStrategy,
} from "../domain/claim-verification";
import { createPostgresAccessRepository } from "../repositories/access-repository.factory";
import { AccessLoginService } from "../services/access-login.service";
import { AccessService } from "../services/access.service";
import { createPostgresSettingsRepository } from "@/features/settings/repositories/settings-repository.factory";

export interface RuntimeAccessSettings {
  accessCodePrefix: string;
  claimVerificationStrategy: ClaimVerificationStrategy;
  sessionTtlSeconds: number;
}

function parseClaimVerificationStrategy(
  value: string | null | undefined,
): ClaimVerificationStrategy {
  return CLAIM_VERIFICATION_STRATEGIES.includes(
    value as ClaimVerificationStrategy,
  )
    ? (value as ClaimVerificationStrategy)
    : "preauth-only";
}

export async function getRuntimeAccessSettings(): Promise<RuntimeAccessSettings> {
  const settings = await createPostgresSettingsRepository().getPlatformSettings();
  return {
    accessCodePrefix:
      settings.accessCodePrefix || process.env.MKLMS_ACCESS_CODE_PREFIX || "ACCESS",
    claimVerificationStrategy: parseClaimVerificationStrategy(
      settings.claimVerificationStrategy ||
        process.env.MKLMS_CLAIM_VERIFICATION_STRATEGY,
    ),
    sessionTtlSeconds: Number(
      process.env.MKLMS_STUDENT_SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 14,
    ),
  };
}

export async function getAccessRuntime() {
  const repository = createPostgresAccessRepository();
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
