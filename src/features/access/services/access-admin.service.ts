import {
  generateAccessCode,
  getAccessCodeLookupHash,
  hashAccessCode,
} from "../domain/access-code";
import { hashClaimCode } from "../domain/claim-code";
import type {
  AdminAccessRepository,
  CreatePreauthorizationInput,
  StudentAccessStatus,
} from "../repositories/admin-access.repository";
import type { ClaimVerificationStrategy } from "../domain/claim-verification";

export interface AccessAdminServiceOptions {
  accessCodePrefix: string;
}

export interface PreauthorizeStudentInput {
  email?: string | null;
  phone?: string | null;
  nameHint?: string | null;
  courseId?: string | null;
  claimStrategy: ClaimVerificationStrategy;
  claimCode?: string | null;
  source?: string;
  externalReference?: string | null;
}

export class AccessAdminService {
  private readonly repository: AdminAccessRepository;
  private readonly options: AccessAdminServiceOptions;

  constructor(
    repository: AdminAccessRepository,
    options: AccessAdminServiceOptions,
  ) {
    this.repository = repository;
    this.options = options;
  }

  async preauthorize(input: PreauthorizeStudentInput) {
    const normalized: CreatePreauthorizationInput = {
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.replace(/\D/g, "") || null,
      nameHint: input.nameHint?.trim() || null,
      courseId: input.courseId?.trim() || null,
      claimStrategy: input.claimStrategy,
      claimCodeHash:
        input.claimStrategy === "claim-code" && input.claimCode
          ? hashClaimCode(input.claimCode)
          : null,
      source: input.source?.trim() || "manual",
      externalReference: input.externalReference?.trim() || null,
    };

    if (!normalized.email && !normalized.phone) {
      throw new Error("At least one approved identity is required.");
    }

    if (normalized.claimStrategy === "claim-code" && !normalized.claimCodeHash) {
      throw new Error("A claim code is required for claim-code verification.");
    }

    return this.repository.createPreauthorization(normalized);
  }

  async resetStudentAccessCode(studentId: string) {
    const accessCode = generateAccessCode({
      prefix: this.options.accessCodePrefix,
    });

    await this.repository.replaceAccessCredential(studentId, {
      hash: hashAccessCode(accessCode),
      lookupHash: getAccessCodeLookupHash(accessCode),
      prefix: this.options.accessCodePrefix,
    });

    return { accessCode };
  }

  async setStudentStatus(
    studentId: string,
    status: StudentAccessStatus,
  ): Promise<void> {
    await this.repository.setStudentStatus(studentId, status);
  }
}
