export type RepositoryBackend = "postgresql" | "d1";

export type RepositoryBackendDependencies<PostgresPool, D1Binding> = {
  postgresPool?: PostgresPool;
  d1?: D1Binding;
};

export type RepositoryFactoryMap<PostgresPool, D1Binding> = Record<string, {
  postgresql?: (pool: PostgresPool) => unknown;
  d1?: (binding: D1Binding) => unknown;
}>;

/** Constructs a complete repository set from exactly one explicit backend. */
export function createRepositorySetForBackend<PostgresPool, D1Binding>(
  backend: string,
  dependencies: RepositoryBackendDependencies<PostgresPool, D1Binding>,
  factories: RepositoryFactoryMap<PostgresPool, D1Binding>,
): Record<string, unknown> {
  if (backend !== "postgresql" && backend !== "d1") {
    throw new Error(`Unsupported database backend: ${backend}`);
  }

  const names = Object.keys(factories).sort();
  if (names.length === 0) throw new Error("Repository factory map must not be empty");

  const repositories: Record<string, unknown> = {};
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    for (const name of names) {
      const factory = factories[name]?.d1;
      if (!factory) throw new Error(`D1 factory is missing for ${name}`);
      repositories[name] = factory(dependencies.d1);
    }
  } else {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    for (const name of names) {
      const factory = factories[name]?.postgresql;
      if (!factory) throw new Error(`PostgreSQL factory is missing for ${name}`);
      repositories[name] = factory(dependencies.postgresPool);
    }
  }
  return repositories;
}
