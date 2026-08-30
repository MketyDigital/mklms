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
    credential: { hash: AccessCodeHash; prefix: string },
  ): Promise<void>;
  activateEnrollment(studentId: string, courseId: string): Promise<void>;
}
