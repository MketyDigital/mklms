import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1CertificateRepository } from "./d1-certificate.repository.ts";
import { D1CertificateTemplateRepository } from "./d1-certificate-template.repository.ts";
import { PostgresCertificateRepository } from "./postgres-certificate.repository.ts";
import { PostgresCertificateTemplateRepository } from "./postgres-certificate-template.repository.ts";

type CertificateRepositoryDependencies = {
  postgresPool?: Pool;
  d1?: D1DatabaseLike;
};

export function createCertificateRepositoryForBackend(
  backend: string,
  dependencies: CertificateRepositoryDependencies,
): D1CertificateRepository | PostgresCertificateRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresCertificateRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1CertificateRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

export function createCertificateTemplateRepositoryForBackend(
  backend: string,
  dependencies: CertificateRepositoryDependencies,
): D1CertificateTemplateRepository | PostgresCertificateTemplateRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresCertificateTemplateRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1CertificateTemplateRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Current certificate paths stay explicitly PostgreSQL-backed. */
export function createPostgresCertificateRepository(pool?: Pool): PostgresCertificateRepository {
  return pool ? new PostgresCertificateRepository(pool) : new PostgresCertificateRepository();
}

/** Current certificate-template paths stay explicitly PostgreSQL-backed. */
export function createPostgresCertificateTemplateRepository(
  pool?: Pool,
): PostgresCertificateTemplateRepository {
  return pool ? new PostgresCertificateTemplateRepository(pool) : new PostgresCertificateTemplateRepository();
}
