import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1QuizRepository } from "./d1-quiz.repository.ts";
import { PostgresQuizRepository } from "./postgres-quiz.repository.ts";

type QuizRepositoryDependencies = {
  postgresPool?: Pool;
  d1?: D1DatabaseLike;
};

export function createQuizRepositoryForBackend(
  backend: string,
  dependencies: QuizRepositoryDependencies,
): D1QuizRepository | PostgresQuizRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresQuizRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1QuizRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Current quiz paths remain explicitly PostgreSQL-backed. */
export function createPostgresQuizRepository(pool?: Pool): PostgresQuizRepository {
  return pool ? new PostgresQuizRepository(pool) : new PostgresQuizRepository();
}
