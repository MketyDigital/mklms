/** Shared UTF-8 JSON tuple encoding used by SQLite triggers and PostgreSQL migrations.
 * Pure identifier function: does not grant enrollment or perform a database write.
 */
export function allActiveEnrollmentId(studentId: string, courseId: string): string {
  if (!studentId || !courseId || typeof studentId !== "string" || typeof courseId !== "string")
    throw new Error("Student and course IDs are required");
  const bytes = new TextEncoder().encode(JSON.stringify([studentId, courseId, "all-active"]));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
