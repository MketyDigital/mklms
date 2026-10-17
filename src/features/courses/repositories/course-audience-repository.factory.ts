import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1CourseAudienceRepository } from "./d1-course-audience.repository.ts";
import { PostgresCourseAudienceRepository } from "./postgres-course-audience.repository.ts";

type CourseAudienceRepositoryDependencies = {
  postgresPool?: Pool;
  d1?: D1DatabaseLike;
};

export function createCourseAudienceRepositoryForBackend(
  backend: string,
  dependencies: CourseAudienceRepositoryDependencies,
): D1CourseAudienceRepository | PostgresCourseAudienceRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresCourseAudienceRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1CourseAudienceRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Current course-audience paths remain explicitly PostgreSQL-backed. */
export function createPostgresCourseAudienceRepository(
  pool?: Pool,
): PostgresCourseAudienceRepository {
  return pool ? new PostgresCourseAudienceRepository(pool) : new PostgresCourseAudienceRepository();
}
