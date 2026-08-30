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

export interface AccessRepository {
  findPreauthorization(
    identity: ClaimIdentityInput,
  ): Promise<PreauthorizationRecord | null>;
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
  findActiveCredentialByLookupHash(
    lookupHash: string,
  ): Promise<ActiveCredentialRecord | null>;
  activateEnrollment(studentId: string, courseId: string): Promise<void>;
  createSession(studentId: string, input: CreateSessionInput): Promise<void>;
  revokeSession(tokenHash: string): Promise<void>;
}
