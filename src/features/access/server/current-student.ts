import { cookies } from "next/headers";

import { hashSessionToken } from "../domain/session";
import { PostgresAccessRepository } from "../repositories/postgres-access.repository";
import { STUDENT_SESSION_COOKIE } from "./session-cookie";

export async function getCurrentStudentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const repository = new PostgresAccessRepository();
  return repository.findActiveSessionByTokenHash(
    hashSessionToken(sessionToken).hash,
    new Date(),
  );
}
