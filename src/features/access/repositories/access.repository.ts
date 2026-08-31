import type {
  AccessCodeHash,
  ClaimIdentityInput,
  PreauthorizationRecord,
} from "../types";

export interface CreateStudentInput {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  certificateName: string;
  certificateEmail?: string | null;
}

export interface StudentRecord extends CreateStudentInput {
  id: string;
}

export interface ActiveCredentialRecord {
  studentId: string;
  status: "ACTIVE";
  hash: AccessCodeHash;
}

export interface CreateSessionInput {
  tokenHash: string;
  expiresAt: Date;
}

export interface ActiveSessionRecord {
  studentId: string;
  displayName: string;
  email?: string | null;
  expiresAt: Date;
}

export interface CompleteVerifiedClaimRepositoryInput {
  preauthorizationId: string;
  student: CreateStudentInput;
  courseId?: string | null;
  credential: {
    hash: AccessCodeHash;
    lookupHash: string;
    prefix: string;
  };
}

export interface AccessRepository {
  findPreauthorization(
    identity: ClaimIdentityInput,
  ): Promise<PreauthorizationRecord | null>;
  markPreauthorizationClaimRequested(preauthorizationId: string): Promise<void>;
  createStudent(input: CreateStudentInput): Promise<StudentRecord>;
  markPreauthorizationClaimed(
    preauthorizationId: string,
    studentId: string,
  ): Promise<void>;
  replaceAccessCredential(
    studentId: string,
    credential: {
      hash: AccessCodeHash;
      lookupHash: string;
      prefix: string;
    },
  ): Promise<void>;
  activateEnrollment(studentId: string, courseId: string): Promise<void>;
  completeVerifiedClaim(
    input: CompleteVerifiedClaimRepositoryInput,
  ): Promise<StudentRecord>;
  findActiveCredentialByLookupHash(
    lookupHash: string,
  ): Promise<ActiveCredentialRecord | null>;
  createSession(studentId: string, input: CreateSessionInput): Promise<void>;
  findActiveSessionByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<ActiveSessionRecord | null>;
  revokeSession(tokenHash: string): Promise<void>;
}
