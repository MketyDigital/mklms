import { createHash } from "node:crypto";

/** Byte-for-byte equivalent to PostgreSQL md5(student_id || ':' || course_id || ':all-active').
 * Pure identifier function: does not grant enrollment or perform a database write.
 */
export function allActiveEnrollmentId(studentId: string, courseId: string): string {
  if (!studentId || !courseId || typeof studentId !== "string" || typeof courseId !== "string")
    throw new Error("Student and course IDs are required");
  return createHash("md5").update(`${studentId}:${courseId}:all-active`, "utf8").digest("hex");
}
