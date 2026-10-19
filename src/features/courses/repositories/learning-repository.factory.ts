import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1AdminLearningRepository } from "./d1-admin-learning.repository.ts";
import { D1LearningRepository } from "./d1-learning.repository.ts";
import { PostgresAdminLearningRepository } from "./postgres-admin-learning.repository.ts";
import { PostgresLearningRepository } from "./postgres-learning.repository.ts";
import type { AdminLearningRepository } from "../services/admin-learning.service.ts";
import type { LearningProgressRepository } from "../services/learning-progress.service.ts";
import type { StudentLearningRepository } from "../services/student-learning.service.ts";

type LearningRepositoryDependencies = {
  postgresPool?: Pool;
  d1?: D1DatabaseLike;
};

export function createAdminLearningRepositoryForBackend(
  backend: string,
  dependencies: LearningRepositoryDependencies,
): AdminLearningRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresAdminLearningRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1AdminLearningRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

export function createStudentLearningRepositoryForBackend(
  backend: string,
  dependencies: LearningRepositoryDependencies,
): StudentLearningRepository & LearningProgressRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresLearningRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1LearningRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Current application learning paths remain explicitly PostgreSQL-backed. */
export function createPostgresAdminLearningRepository(pool?: Pool): PostgresAdminLearningRepository {
  return pool ? new PostgresAdminLearningRepository(pool) : new PostgresAdminLearningRepository();
}

/** Current application learning paths remain explicitly PostgreSQL-backed. */
export function createPostgresLearningRepository(pool?: Pool): PostgresLearningRepository {
  return pool ? new PostgresLearningRepository(pool) : new PostgresLearningRepository();
}
