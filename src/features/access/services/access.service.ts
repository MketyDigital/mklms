import { generateAccessCode, hashAccessCode } from "../domain/access-code";
import type { AccessRepository } from "../repositories/access.repository";
import type { ClaimIdentityInput } from "../types";

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

  constructor(
    repository: AccessRepository,
    options: AccessServiceOptions,
  ) {
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

    const student = await this.repository.createStudent({
      displayName: input.certificateName.trim(),
      email: input.identity.email?.trim() || null,
      phone: input.identity.phone?.trim() || null,
      certificateName: input.certificateName.trim(),
      certificateEmail: input.certificateEmail?.trim() || null,
    });

    const accessCode = generateAccessCode({
      prefix: this.options.accessCodePrefix,
    });
    const hash = hashAccessCode(accessCode);

    await this.repository.replaceAccessCredential(student.id, {
      hash,
      prefix: this.options.accessCodePrefix,
    });

    if (preauthorization.courseId) {
      await this.repository.activateEnrollment(
        student.id,
        preauthorization.courseId,
      );
    }

    await this.repository.markPreauthorizationClaimed(
      preauthorization.id,
      student.id,
    );

    return {
      ok: true,
      studentId: student.id,
      accessCode,
    };
  }
}
