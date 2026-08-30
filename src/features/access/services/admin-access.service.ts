import {
  getAccessCodeLookupHash,
  generateAccessCode,
  hashAccessCode,
} from "../domain/access-code";
import {
  parsePreauthorizationCsv,
  parsePreauthorizationPaste,
} from "../domain/import-preauthorizations";
import type { ClaimVerificationStrategy } from "../domain/claim-verification";
import type { AdminAccessRepository } from "../repositories/admin-access.repository";

export interface AdminAccessServiceOptions {
  accessCodePrefix: string;
}

export interface BulkAuthorizeInput {
  mode: "csv" | "paste";
  input: string;
  courseId?: string | null;
  claimStrategy: ClaimVerificationStrategy;
  source: string;
}

export class AdminAccessService {
  private readonly repository: AdminAccessRepository;
  private readonly options: AdminAccessServiceOptions;

  constructor(
    repository: AdminAccessRepository,
    options: AdminAccessServiceOptions,
  ) {
    this.repository = repository;
    this.options = options;
  }

  async bulkAuthorize(input: BulkAuthorizeInput) {
    const parsed =
      input.mode === "csv"
        ? parsePreauthorizationCsv(input.input)
        : parsePreauthorizationPaste(input.input);

    let created = 0;
    let skippedDuplicates = 0;

    for (const row of parsed.rows) {
      const result = await this.repository.createPreauthorization({
        email: row.email ?? null,
        phone: row.phone ?? null,
        nameHint: row.name ?? null,
        courseId: row.courseId ?? input.courseId ?? null,
        claimStrategy: input.claimStrategy,
        source: input.source,
      });

      if (result.created) created += 1;
      else skippedDuplicates += 1;
    }

    return {
      created,
      skippedDuplicates,
      errors: parsed.errors,
    };
  }

  async resetAccessCode(studentId: string) {
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
    status: "ACTIVE" | "SUSPENDED" | "REVOKED",
  ) {
    await this.repository.setStudentStatus(studentId, status);
  }
}
