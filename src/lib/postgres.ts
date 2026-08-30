import { Pool } from "pg";

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
  }

  pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl:
      process.env.DATABASE_SSL === "disable"
        ? false
        : process.env.DATABASE_SSL === "require"
          ? { rejectUnauthorized: false }
          : undefined,
  });

  return pool;
}
