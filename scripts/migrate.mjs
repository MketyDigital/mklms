import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    process.stdout.write(`Applying ${file}... `);
    await client.query(await readFile(path.join(dir, file), "utf8"));
    console.log("done");
  }
  console.log(`MkLMS database ready (${files.length} migrations).`);
} finally {
  await client.end();
}
