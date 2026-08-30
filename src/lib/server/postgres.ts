import "server-only";

import { Pool } from "pg";

let pool: Pool | undefined;

export function getPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl:
        process.env.DATABASE_SSL === "disable"
          ? false
          : process.env.DATABASE_SSL === "require"
            ? { rejectUnauthorized: false }
            : undefined,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    });
  }

  return pool;
}
