import type { ClaimVerificationStrategy } from "../domain/claim-verification";
import type { AccessCodeHash, PreauthorizationRecord } from "../types";

export type StudentAccessStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface CreatePreauthorizationInput {
  email?: string | null;
  phone?: string | null;
  nameHint?: string | null;
  courseId?: string | null;
  claimStrategy: ClaimVerificationStrategy;
  claimCodeHash?: string | null;
  source: string;
  externalReference?: string | null;
}

export interface CreatePreauthorizationResult {
  record: PreauthorizationRecord;
  created: boolean;
}

export interface AdminStudentSummary {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  status: StudentAccessStatus;
  createdAt: Date;
}

export interface AdminAccessRepository {
  createPreauthorization(
    input: CreatePreauthorizationInput,
  ): Promise<CreatePreauthorizationResult>;
  listPreauthorizations(limit?: number): Promise<PreauthorizationRecord[]>;
  approveManualClaim(preauthorizationId: string): Promise<void>;
  listStudents(limit?: number): Promise<AdminStudentSummary[]>;
  replaceAccessCredential(
    studentId: string,
    credential: {
      hash: AccessCodeHash;
      lookupHash: string;
      prefix: string;
    },
  ): Promise<void>;
  setStudentStatus(studentId: string, status: StudentAccessStatus): Promise<void>;
}
