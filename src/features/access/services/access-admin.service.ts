import {
  generateAccessCode,
  getAccessCodeLookupHash,
  hashAccessCode,
} from "../domain/access-code.ts";
import { hashClaimCode } from "../domain/claim-code.ts";
import {
  parsePreauthorizationCsv,
  parsePreauthorizationPaste,
} from "../domain/import-preauthorizations.ts";
import type {
  AdminAccessRepository,
  CreatePreauthorizationInput,
  StudentAccessStatus,
} from "../repositories/admin-access.repository.ts";
import type { ClaimVerificationStrategy } from "../domain/claim-verification.ts";

export interface AccessAdminServiceOptions {
  accessCodePrefix: string;
  claimCodePrefix?: string;
  validCourseIds?: ReadonlySet<string>;
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

export interface BulkPreauthorizeInput {
  mode: "csv" | "paste";
  content: string;
  courseId?: string | null;
  claimStrategy: ClaimVerificationStrategy;
  source?: string;
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

    if (
      normalized.courseId &&
      this.options.validCourseIds &&
      !this.options.validCourseIds.has(normalized.courseId)
    ) {
      throw new Error("The selected course does not exist.");
    }

    if (normalized.claimStrategy === "claim-code" && !normalized.claimCodeHash) {
      throw new Error("A claim code is required for claim-code verification.");
    }

    const result = await this.repository.createPreauthorization(normalized);
    return { ...result.record, created: result.created };
  }

  async bulkPreauthorize(input: BulkPreauthorizeInput) {
    const imported =
      input.mode === "csv"
        ? parsePreauthorizationCsv(input.content)
        : parsePreauthorizationPaste(input.content);

    const created: Array<{
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      courseId?: string | null;
      claimCode?: string;
    }> = [];
    let skippedDuplicates = 0;
    const errors = [...imported.errors];
    const selectedCourseId = input.courseId?.trim() || null;

    for (let index = 0; index < imported.rows.length; index += 1) {
      const row = imported.rows[index];
      const courseId = selectedCourseId ?? row.courseId?.trim() ?? null;
      const claimCode =
        input.claimStrategy === "claim-code"
          ? generateAccessCode({
              prefix: this.options.claimCodePrefix ?? "CLAIM",
              randomBytes: 12,
            })
          : undefined;

      try {
        const result = await this.preauthorize({
          email: row.email,
          phone: row.phone,
          nameHint: row.name,
          courseId,
          claimStrategy: input.claimStrategy,
          claimCode,
          source:
            input.source ??
            (input.mode === "csv" ? "csv-import" : "bulk-paste"),
        });

        if (!result.created) {
          skippedDuplicates += 1;
          continue;
        }

        created.push({
          id: result.id,
          name: result.nameHint ?? row.name ?? null,
          email: result.email,
          phone: result.phone,
          courseId: result.courseId ?? courseId,
          ...(claimCode ? { claimCode } : {}),
        });
      } catch (error) {
        errors.push({
          line: index + 1,
          code: "INVALID_IDENTITY",
          message:
            error instanceof Error
              ? error.message
              : "Could not authorize this row.",
        });
      }
    }

    return {
      createdCount: created.length,
      skippedDuplicates,
      created,
      errors,
    };
  }

  async approveManualClaim(preauthorizationId: string): Promise<void> {
    await this.repository.approveManualClaim(preauthorizationId);
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
