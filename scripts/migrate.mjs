import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), "db", "migrations");

function shouldUseSsl(url) {
  return !/localhost|127\.0\.0\.1/.test(url);
}

const client = new Client({
  connectionString,
  ssl: shouldUseSsl(connectionString)
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  const { rows } = await client.query("select id from schema_migrations");
  const applied = new Set(rows.map((row) => row.id));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");

    console.log(`Applying ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (id) values ($1)", [file]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  console.log("Migrations complete.");
} finally {
  await client.end();
}
