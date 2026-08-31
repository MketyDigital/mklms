import {
  generateAccessCode,
  getAccessCodeLookupHash,
  hashAccessCode,
} from "../domain/access-code.ts";
import type { AccessRepository } from "../repositories/access.repository.ts";
import type { ClaimIdentityInput } from "../types.ts";

export interface AccessServiceOptions {
  accessCodePrefix: string;
}

export interface CompleteVerifiedClaimInput {
  identity: ClaimIdentityInput;
  certificateName: string;
  certificateEmail?: string | null;
}

export type CompleteVerifiedClaimResult =
  | { ok: true; studentId: string; accessCode: string }
  | { ok: false; publicMessage: string };

const NEUTRAL_CLAIM_FAILURE = "We couldn't verify access with those details.";

export class AccessService {
  private readonly repository: AccessRepository;
  private readonly options: AccessServiceOptions;

  constructor(repository: AccessRepository, options: AccessServiceOptions) {
    this.repository = repository;
    this.options = options;
  }

  async completeVerifiedClaim(
    input: CompleteVerifiedClaimInput,
  ): Promise<CompleteVerifiedClaimResult> {
    const preauthorization = await this.repository.findPreauthorization(
      input.identity,
    );

    if (!preauthorization || preauthorization.status !== "PREAUTHORIZED") {
      return { ok: false, publicMessage: NEUTRAL_CLAIM_FAILURE };
    }

    const accessCode = generateAccessCode({
      prefix: this.options.accessCodePrefix,
    });
    const hash = hashAccessCode(accessCode);

    const student = await this.repository.completeVerifiedClaim({
      preauthorizationId: preauthorization.id,
      student: {
        displayName: input.certificateName.trim(),
        email: input.identity.email?.trim() || null,
        phone: input.identity.phone?.trim() || null,
        certificateName: input.certificateName.trim(),
        certificateEmail: input.certificateEmail?.trim() || null,
      },
      courseId: preauthorization.courseId,
      credential: {
        hash,
        lookupHash: getAccessCodeLookupHash(accessCode),
        prefix: this.options.accessCodePrefix,
      },
    });

    return {
      ok: true,
      studentId: student.id,
      accessCode,
    };
  }
}
